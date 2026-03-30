import cv2
import threading
import time
import logging
from datetime import datetime
from ultralytics import YOLO
import mysql.connector
import torch

logging.basicConfig(level=logging.INFO)

# =========================
# CAMERA SOURCES
# =========================
video_sources = {
    "C1":"rtsp://admin:12345678@192.168.43.184:10554/tcp/av0_0",
    "C2":"rtsp://admin:12345678@192.168.43.45:10554/tcp/av0_0",
    "C3":"rtsp://admin:12345678@192.168.43.76:10554/tcp/av0_0",
    "C4":"rtsp://admin:12345678@192.168.43.107:10554/tcp/av0_0"
}

# =========================
# MYSQL CONFIG
# =========================
DB_CONFIG = {
    "host":"localhost",
    "user":"root",
    "password":"190425451423",
    "database":"cats_db"
}

# =========================
# YOLO MODEL
# =========================
device = "cuda" if torch.cuda.is_available() else "cpu"

model = YOLO("runs/detect/train_gpu_small/weights/best.pt")
model.to(device)

CAT_ID = 0
FOOD_BOWL_ID = 1
LITTER_BOX_ID = 2

CONF_THRESHOLD = 0.5
IOU_THRESHOLD = 0.3

# =========================
# COLORS (ตรงกับ table)
# =========================
COLOR_LIST = ["pink","green","yellow","orange","red"]

# =========================
# SLOT STATE
# =========================
def new_slot_state():

    state = {}

    for c in COLOR_LIST:

        state[c] = {
            "found":"NF",
            "ac":None,
            "cam":None
        }

    return state

slot_data = new_slot_state()
slot_lock = threading.Lock()

# =========================
# TIMESLOT
# =========================
SLOT_SECONDS = 60
current_slot = None

def get_timeslot():

    now = datetime.now()

    total = now.minute*60 + now.second
    slot_sec = (total // SLOT_SECONDS) * SLOT_SECONDS

    minute = slot_sec // 60
    second = slot_sec % 60

    slot_time = now.replace(
        minute=minute,
        second=second,
        microsecond=0
    ).time()

    return now.date(),slot_time

# =========================
# IOU
# =========================
def iou(a,b):

    if b is None:
        return 0

    xA=max(a[0],b[0])
    yA=max(a[1],b[1])
    xB=min(a[2],b[2])
    yB=min(a[3],b[3])

    inter=max(0,xB-xA)*max(0,yB-yA)

    areaA=(a[2]-a[0])*(a[3]-a[1])
    areaB=(b[2]-b[0])*(b[3]-b[1])

    return inter/(areaA+areaB-inter+1e-6)

# =========================
# ACTIVITY MEMORY
# =========================
locked_food={}
locked_litter={}

def infer_activity(cat_box,cam):

    if cam in locked_food and iou(cat_box,locked_food[cam]) > IOU_THRESHOLD:
        return "eat"

    if cam in locked_litter and iou(cat_box,locked_litter[cam]) > IOU_THRESHOLD:
        return "excrete"

    return "NO"

# =========================
# DATABASE UPSERT
# =========================
def upsert_slot(date,slot,data):

    try:

        db = mysql.connector.connect(**DB_CONFIG)
        cursor = db.cursor()

        cols=[]
        vals=[]
        upd=[]

        for color,d in data.items():

            c=color

            cols.extend([
                c,
                f"{c}_ac",
                f"{c}_cam"
            ])

            if d["found"] == "NF":

                vals.extend([
                    "NF",
                    None,
                    None
                ])

            else:

                vals.extend([
                    "F",
                    d["ac"],
                    d["cam"]
                ])

            upd.append(f"{c}=VALUES({c})")
            upd.append(f"{c}_ac=VALUES({c}_ac)")
            upd.append(f"{c}_cam=VALUES({c}_cam)")

        sql=f"""
        INSERT INTO timeslot (date,slot,{",".join(cols)})
        VALUES (%s,%s,{",".join(["%s"]*len(vals))})
        ON DUPLICATE KEY UPDATE {",".join(upd)}
        """

        cursor.execute(sql,[date,slot]+vals)

        db.commit()
        db.close()

        print("UPSERT OK:",date,slot)

    except Exception as e:

        print("MYSQL ERROR:",e)

# =========================
# FRAME STORAGE
# =========================
latest_frames={}
frame_lock=threading.Lock()

# =========================
# CAPTURE THREAD
# =========================
def capture_stream(cam,src):

    cap=cv2.VideoCapture(src,cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE,1)

    while True:

        ret,frame=cap.read()

        if not ret:

            print("Camera reconnect:",cam)
            time.sleep(1)
            continue

        frame=cv2.resize(frame,(640,360))

        with frame_lock:
            latest_frames[cam]=frame

# =========================
# YOLO INFERENCE LOOP
# =========================
def inference_loop():

    while True:

        with frame_lock:
            frames=list(latest_frames.items())

        for cam,frame in frames:

            results=model(frame,conf=CONF_THRESHOLD)

            for r in results:

                for box in r.boxes:

                    cls=int(box.cls[0])

                    x1,y1,x2,y2=map(int,box.xyxy[0])

                    if cls==FOOD_BOWL_ID:
                        locked_food[cam]=(x1,y1,x2,y2)

                    elif cls==LITTER_BOX_ID:
                        locked_litter[cam]=(x1,y1,x2,y2)

                    elif cls == CAT_ID:

                        color = "pink"   # หรือ detect_color

                        if color not in slot_data:
                            continue

                        act = infer_activity((x1,y1,x2,y2), cam)

                        with slot_lock:

                            # พบแมว
                            slot_data[color]["found"] = "F"

                            # กล้องต้องบันทึกทันที
                            slot_data[color]["cam"] = cam

                            # activity
                            if act is None:
                                slot_data[color]["ac"] = "NO"
                            else:
                                slot_data[color]["ac"] = act

                        cv2.rectangle(
                            frame,
                            (x1,y1),
                            (x2,y2),
                            (0,255,0),
                            2
                        )

            cv2.imshow(cam,frame)

        cv2.waitKey(1)

# =========================
# TIMESLOT WRITER
# =========================
def timeslot_writer():

    global current_slot,slot_data

    while True:

        date,slot=get_timeslot()

        if current_slot is None:

            current_slot=slot

        elif current_slot!=slot:

            print("WRITE SLOT:",date,current_slot)

            with slot_lock:

                upsert_slot(date,current_slot,slot_data)

                slot_data=new_slot_state()

            current_slot=slot

        time.sleep(1)

# =========================
# START THREADS
# =========================
for cam,src in video_sources.items():

    t=threading.Thread(
        target=capture_stream,
        args=(cam,src),
        daemon=True
    )
    t.start()

threading.Thread(
    target=inference_loop,
    daemon=True
).start()

threading.Thread(
    target=timeslot_writer,
    daemon=True
).start()

while True:
    time.sleep(10)