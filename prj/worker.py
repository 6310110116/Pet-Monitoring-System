import os
import signal
import sys
import time
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app import (
    app,
    db_config,
    _ensure_line_tables,
    _ensure_notification_state_table,
    _ensure_alerts_log_schema,
    _ensure_users_table,
    _bootstrap_admin_user,
    _get_alert_target_day,
    _ingest_daily_behavior_for_day,
    _ingest_realtime_no_cat,
    _run_line_alert_push_job,
    _send_web_push_to_all,
    get_db,
)

scheduler = None


def _init_tables():
    try:
        _ensure_users_table()
        _bootstrap_admin_user()
        _ensure_line_tables()
        _ensure_notification_state_table()
        _ensure_alerts_log_schema()
    except Exception as e:
        app.logger.error(f"[WORKER] init error: {e}", exc_info=True)
        raise


def _run_realtime_no_cat_job():
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    try:
        inserted = _ingest_realtime_no_cat(cur)
        conn.commit()
        app.logger.info(f"[WORKER][REALTIME] inserted={inserted}")
        if inserted and inserted > 0:
            _run_line_alert_push_job()
            try:
                _send_web_push_to_all('Pet Monitoring', f'มีการแจ้งเตือนใหม่ {inserted} รายการ', '/')
            except Exception as push_err:
                app.logger.warning(f"[WORKER][REALTIME] web push warning: {push_err}")
    except Exception as e:
        app.logger.error(f"[WORKER][REALTIME] error: {e}", exc_info=True)
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        try:
            cur.close()
        finally:
            conn.close()


def _run_daily_behavior_job():
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    try:
        target_day = _get_alert_target_day(cur)
        inserted = _ingest_daily_behavior_for_day(cur, target_day)
        conn.commit()
        app.logger.info(f"[WORKER][DAILY] target_day={target_day} inserted={inserted}")
        if inserted and inserted > 0:
            _run_line_alert_push_job()
            try:
                _send_web_push_to_all('Pet Monitoring', f'สรุปประจำวัน: มีการแจ้งเตือนใหม่ {inserted} รายการ', '/')
            except Exception as push_err:
                app.logger.warning(f"[WORKER][DAILY] web push warning: {push_err}")
    except Exception as e:
        app.logger.error(f"[WORKER][DAILY] error: {e}", exc_info=True)
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        try:
            cur.close()
        finally:
            conn.close()


def start_worker():
    global scheduler
    if scheduler is not None:
        return scheduler

    _init_tables()

    realtime_seconds = int(os.environ.get("REALTIME_ALERT_INTERVAL_SECONDS", "60"))
    daily_hour = int(os.environ.get("DAILY_ALERT_HOUR", "23"))
    daily_minute = int(os.environ.get("DAILY_ALERT_MINUTE", "59"))

    scheduler = BackgroundScheduler(timezone="Asia/Bangkok")
    scheduler.add_job(
        _run_realtime_no_cat_job,
        trigger=IntervalTrigger(seconds=realtime_seconds),
        id="worker_realtime_no_cat",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        _run_daily_behavior_job,
        trigger=CronTrigger(hour=daily_hour, minute=daily_minute),
        id="worker_daily_behavior",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()

    app.logger.info(
        f"[WORKER] started realtime every {realtime_seconds}s; daily at {daily_hour:02d}:{daily_minute:02d} Asia/Bangkok"
    )

    try:
        _run_realtime_no_cat_job()
    except Exception:
        pass

    return scheduler



def _shutdown(*_args):
    global scheduler
    try:
        if scheduler:
            scheduler.shutdown(wait=False)
    except Exception:
        pass
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)
    start_worker()
    while True:
        time.sleep(60)
