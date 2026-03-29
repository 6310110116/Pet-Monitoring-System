import cv2
import threading
import time
from datetime import datetime
import mysql.connector

# ======================
# CAMERA
# ======================

video_sources = {
    "C1":"rtsp://admin:12345678@192.168.43.184:10554/tcp/av0_0",
    "C2":"rtsp://admin:12345678@192.168.43.45:10554/tcp/av0_0",
    "C3":"rtsp://admin:12345678@192.168.43.76:10554/tcp/av0_0",
    "C4":"rtsp://admin:12345678@192.168.43.107:10554/tcp/av0_0"
}

# ======================
# MYSQL
# ======================

DB_CONFIG = {
    "host":"localhost",
    "user":"root",
    "password":"190425451423",
    "database":"cats_db"
}

# ======================
# COLOR LIST
# ======================

COLOR_LIST = ["pink","green","yellow","orange","red","blue"]

# ======================
# SLOT STATE
# ======================

def new_slot_state():

    state={}

    for c in COLOR_LIST:

        state[c]={
            "found":"NF",
            "ac":None,
            "cam":None
        }

    return state

slot_data=new_slot_state()
slot_lock=threading.Lock()

# ======================
# TIMESLOT
# ======================

SLOT_SECONDS=60
current_slot=None

def get_timeslot():

    now=datetime.now()

    total=now.minute*60+now.second
    slot_sec=(total//SLOT_SECONDS)*SLOT_SECONDS

    minute=slot_sec//60
    second=slot_sec%60

    slot_time=now.replace(
        minute=minute,
        second=second,
        microsecond=0
    ).time()

    return now.date(),slot_time

# ======================
# IOU
# ======================

def iou(a,b):

    if a is None or b is None:
        return 0

    xA=max(a[0],b[0])
    yA=max(a[1],b[1])
    xB=min(a[2],b[2])
    yB=min(a[3],b[3])

    inter=max(0,xB-xA)*max(0,yB-yA)

    areaA=(a[2]-a[0])*(a[3]-a[1])
    areaB=(b[2]-b[0])*(b[3]-b[1])

    return inter/(areaA+areaB-inter+1e-6)

# ======================
# MYSQL UPSERT
# ======================

def upsert_slot(date,slot,data):

    try:

        db=mysql.connector.connect(**DB_CONFIG)
        cursor=db.cursor()

        cols=[]
        vals=[]
        upd=[]

        for color,d in data.items():

            cols.extend([color,f"{color}_ac",f"{color}_cam"])

            if d["found"]=="NF":
                vals.extend(["NF",None,None])
            else:
                vals.extend(["F",d["ac"],d["cam"]])

            upd.append(f"{color}=VALUES({color})")
            upd.append(f"{color}_ac=VALUES({color}_ac)")
            upd.append(f"{color}_cam=VALUES({color}_cam)")

        sql=f"""
        INSERT INTO timeslot (date,slot,{",".join(cols)})
        VALUES (%s,%s,{",".join(["%s"]*len(vals))})
        ON DUPLICATE KEY UPDATE {",".join(upd)}
        """

        cursor.execute(sql,[date,slot]+vals)
        db.commit()
        db.close()

        print("MYSQL WRITE:",date,slot)

    except Exception as e:

        print("MYSQL ERROR:",e)

# ======================
# GLOBAL STORAGE
# ======================

latest_frames={}
frame_lock=threading.Lock()

manual_boxes={}
trackers={}
behavior_state={}

for cam in video_sources:

    manual_boxes[cam]={
        "cats":{},
        "food":None,
        "litter":None
    }

    trackers[cam]={}
    behavior_state[cam]={}

MIN_TRACK_BOX_SIZE=12
ACTIVITY_HOLD_SECONDS=3.0
CENTER_ZONE_RATIO=0.35

def box_is_valid_for_frame(box, frame_shape):

    if box is None:
        return False

    x1,y1,x2,y2=box
    h,w=frame_shape[:2]

    if x2<=x1 or y2<=y1:
        return False

    if (x2-x1)<MIN_TRACK_BOX_SIZE or (y2-y1)<MIN_TRACK_BOX_SIZE:
        return False

    if x1<0 or y1<0 or x2>w or y2>h:
        return False

    return True

def get_box_center(box):

    x1,y1,x2,y2=box
    return (x1+x2)/2.0,(y1+y2)/2.0

def get_cat_head_center(box):

    x1,y1,x2,y2=box
    return (x1+x2)/2.0,y1+((y2-y1)*0.25)

def is_near_zone_center(point, zone_box):

    if point is None or zone_box is None:
        return False

    cat_cx,cat_cy=point
    zone_cx,zone_cy=get_box_center(zone_box)
    zone_w=zone_box[2]-zone_box[0]
    zone_h=zone_box[3]-zone_box[1]

    return (
        abs(cat_cx-zone_cx)<=zone_w*CENTER_ZONE_RATIO and
        abs(cat_cy-zone_cy)<=zone_h*CENTER_ZONE_RATIO
    )

def ensure_behavior_state(cam,color):

    if color not in behavior_state[cam]:
        behavior_state[cam][color]={
            "food_since":None,
            "litter_since":None,
            "active":None
        }

    return behavior_state[cam][color]

def clear_cat_state(cam,color):

    if color in manual_boxes[cam]["cats"]:
        del manual_boxes[cam]["cats"][color]

    if color in trackers[cam]:
        del trackers[cam][color]

    if color in behavior_state[cam]:
        del behavior_state[cam][color]

# ======================
# CAMERA THREAD
# ======================

def capture_stream(cam,src):

    cap=cv2.VideoCapture(src)

    while True:

        ret,frame=cap.read()

        if not ret:

            print("Reconnect:",cam)
            time.sleep(1)
            continue

        frame=cv2.resize(frame,(640,360))

        with frame_lock:
            latest_frames[cam]=frame

# ======================
# TRACKER UPDATE
# ======================

def update_trackers():

    for cam in trackers:

        frame=latest_frames.get(cam)

        if frame is None:
            continue

        for color,tracker in list(trackers[cam].items()):

            success,box=tracker.update(frame)

            if success:

                x,y,w,h=map(int,box)
                tracked_box=(x,y,x+w,y+h)

                if box_is_valid_for_frame(tracked_box, frame.shape):
                    manual_boxes[cam]["cats"][color]=tracked_box
                else:
                    clear_cat_state(cam,color)
            else:
                clear_cat_state(cam,color)

# ======================
# MOUSE
# ======================

drawing=False
start=None
current_color="pink"
current_mode="cat"

def mouse_draw(event,x,y,flags,cam):

    global drawing,start,current_color,current_mode

    if event==cv2.EVENT_LBUTTONDOWN:

        drawing=True
        start=(x,y)

    elif event==cv2.EVENT_LBUTTONUP:

        drawing=False

        x1=min(start[0],x)
        y1=min(start[1],y)
        x2=max(start[0],x)
        y2=max(start[1],y)

        box=(x1,y1,x2,y2)

        if current_mode=="cat":

            manual_boxes[cam]["cats"][current_color]=box
            ensure_behavior_state(cam,current_color)

            frame=latest_frames.get(cam)

            if frame is not None:

                tracker=cv2.TrackerCSRT_create()

                tracker.init(frame,(x1,y1,x2-x1,y2-y1))

                trackers[cam][current_color]=tracker

        elif current_mode=="food":

            manual_boxes[cam]["food"]=box

        elif current_mode=="litter":

            manual_boxes[cam]["litter"]=box

    elif event==cv2.EVENT_RBUTTONDOWN:

        for color,box in list(manual_boxes[cam]["cats"].items()):

            x1,y1,x2,y2=box

            if x1<=x<=x2 and y1<=y<=y2:

                clear_cat_state(cam,color)
                break

# ======================
# KEYBOARD
# ======================

def handle_key(k):

    global current_color,current_mode

    if k==ord('1'): current_color="pink"
    if k==ord('2'): current_color="green"
    if k==ord('3'): current_color="yellow"
    if k==ord('4'): current_color="orange"
    if k==ord('5'): current_color="red"
    if k==ord('6'): current_color="blue"

    if k==ord('m'): current_mode="cat"
    if k==ord('f'): current_mode="food"
    if k==ord('l'): current_mode="litter"

    if k==ord('x'):

        for cam in manual_boxes:

            clear_cat_state(cam,current_color)

# ======================
# ACTIVITY
# ======================

def manual_activity():

    now=time.time()

    for cam in manual_boxes:

        food=manual_boxes[cam]["food"]
        litter=manual_boxes[cam]["litter"]
        active_colors=set()

        for color,box in manual_boxes[cam]["cats"].items():

            act="NO"
            state=ensure_behavior_state(cam,color)
            body_center=get_box_center(box)
            head_center=get_cat_head_center(box)

            if is_near_zone_center(head_center,food):
                if state["food_since"] is None:
                    state["food_since"]=now
                if now-state["food_since"]>=ACTIVITY_HOLD_SECONDS:
                    act="eat"
            else:
                state["food_since"]=None

            if is_near_zone_center(body_center,litter):
                if state["litter_since"] is None:
                    state["litter_since"]=now
                if now-state["litter_since"]>=ACTIVITY_HOLD_SECONDS and act=="NO":
                    act="excrete"
            else:
                state["litter_since"]=None

            state["active"]=act if act!="NO" else None
            active_colors.add(color)

            with slot_lock:

                slot_data[color]["found"]="F"
                slot_data[color]["cam"]=cam
                slot_data[color]["ac"]=act

        for color in list(behavior_state[cam].keys()):

            if color not in active_colors:
                del behavior_state[cam][color]

# ======================
# DRAW
# ======================

def draw_boxes(frame,cam):

    food=manual_boxes[cam]["food"]
    litter=manual_boxes[cam]["litter"]

    for color,box in manual_boxes[cam]["cats"].items():

        x1,y1,x2,y2=box

        label=color
        state=behavior_state[cam].get(color,{})
        active=state.get("active")

        if active:
            label+=f"({active})"

        cv2.rectangle(frame,(x1,y1),(x2,y2),(0,255,0),2)

        cv2.putText(frame,label,(x1,y1-10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,(0,255,0),2)

    if food:
        x1,y1,x2,y2=food
        cv2.rectangle(frame,(x1,y1),(x2,y2),(255,0,0),2)
        cv2.putText(frame,"food bowl",(x1,max(20,y1-10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,(255,0,0),2)

    if litter:
        x1,y1,x2,y2=litter
        cv2.rectangle(frame,(x1,y1),(x2,y2),(0,0,255),2)
        cv2.putText(frame,"litter box",(x1,max(20,y1-10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,(0,0,255),2)

# ======================
# TIMESLOT THREAD
# ======================

def timeslot_writer():

    global current_slot,slot_data

    while True:

        date,slot=get_timeslot()

        if current_slot is None:

            current_slot=slot

        elif current_slot!=slot:

            with slot_lock:

                upsert_slot(date,current_slot,slot_data)

                slot_data=new_slot_state()

            current_slot=slot

        time.sleep(1)

# ======================
# START THREADS
# ======================

for cam,src in video_sources.items():

    threading.Thread(
        target=capture_stream,
        args=(cam,src),
        daemon=True
    ).start()

threading.Thread(
    target=timeslot_writer,
    daemon=True
).start()

for cam in video_sources:

    cv2.namedWindow(cam)
    cv2.setMouseCallback(cam,mouse_draw,cam)

# ======================
# MAIN LOOP
# ======================

while True:

    with frame_lock:
        frames=latest_frames.copy()

    update_trackers()

    for cam,frame in frames.items():

        frame=frame.copy()

        draw_boxes(frame,cam)

        cv2.imshow(cam,frame)

    manual_activity()

    k=cv2.waitKey(1)&0xFF

    handle_key(k)
