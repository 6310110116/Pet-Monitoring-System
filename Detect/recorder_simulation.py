# recorder_motion.py

import cv2
import os
import subprocess
import time
import threading
from datetime import datetime

# =========================
# CONFIG
# =========================

FFMPEG = r"C:\ffmpeg-7.1.1-essentials_build\bin\ffmpeg.exe"

RECORD_DURATION = 120
BASE_DIR = "recorded_videos"

# motion threshold
MOTION_PIXELS = 5000

CAMERAS = {
"C1-Front":"rtsp://admin:12345678@192.168.43.184:10554/tcp/av0_0",
"C2-Hall":"rtsp://admin:12345678@192.168.43.45:10554/tcp/av0_0",
"C3-Back":"rtsp://admin:12345678@192.168.43.76:10554/tcp/av0_0",
"C4-New":"rtsp://admin:12345678@192.168.43.107:10554/tcp/av0_0"
}

# =========================
# MOTION DETECTION
# =========================

def detect_motion(prev, frame):

    gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    gray=cv2.GaussianBlur(gray,(21,21),0)

    if prev is None:
        return gray,False

    diff=cv2.absdiff(prev,gray)
    thresh=cv2.threshold(diff,25,255,cv2.THRESH_BINARY)[1]

    motion_pixels=cv2.countNonZero(thresh)

    motion = motion_pixels > MOTION_PIXELS

    return gray,motion

# =========================
# RECORD FUNCTION
# =========================

def record_video(cam,src):

    out_dir=os.path.join(BASE_DIR,cam)
    os.makedirs(out_dir,exist_ok=True)

    cap=cv2.VideoCapture(src)

    prev=None

    while True:

        ret,frame=cap.read()

        if not ret:
            time.sleep(1)
            continue

        frame=cv2.resize(frame,(640,360))

        prev,motion=detect_motion(prev,frame)

        if motion:

            print("MOTION DETECTED:",cam)

            ts=datetime.now().strftime("%Y%m%d_%H%M%S")

            outfile=os.path.join(out_dir,f"{ts}.mp4")

            cmd=[

                FFMPEG,
                "-rtsp_transport","tcp",
                "-i",src,
                "-t",str(RECORD_DURATION),
                "-vcodec","libx264",
                "-preset","ultrafast",
                outfile

            ]

            subprocess.Popen(cmd)

            # กันบันทึกซ้ำ
            time.sleep(RECORD_DURATION)

# =========================
# START THREADS
# =========================

threads=[]

for cam,src in CAMERAS.items():

    if src is None:
        continue

    t=threading.Thread(target=record_video,args=(cam,src),daemon=True)

    t.start()

    threads.append(t)

print("Recorder started")

while True:
    time.sleep(10)