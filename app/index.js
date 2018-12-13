import clock from "clock";
import document from "document";
import * as health from "user-activity";
import {HeartRateSensor} from "heart-rate";
import {display} from "display";
import {battery} from "power";
import {vibration} from "haptics";
import {preferences, units} from "user-settings";
import {user} from "user-profile";
import * as fs from "fs";
import {encode, decode} from "cbor";
import {inbox} from "file-transfer";
import {peerSocket as peer} from "messaging";
import jpeg from "jpeg";

const $ = s => document.getElementById(s);

const pad = n => n < 10 ? "0" + n : n;

//convert float (number) to a string with maximum 2 decimal places
const round = n => {
  n = n.toFixed(2);
  if(n.substr(-2) === "00") return n.substr(0, n.length - 3);
  if(n.substr(-1) === "0") return n.substr(0, n.length - 1);
  return n;
};

let settings = {
  stat: [0, 1, 2, 3],
  heartPos: 0,
  showStats: 70,
  showMarker: 30,
  showCorner: 60
};
let bkgdFile = "";

const METRIC = (units.distance === "metric");
const HOUR12 = (preferences.clockDisplay === "12h");

const weekNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

let bkgdNode = $("bkgd");
let battNode = $("batt");
let weekNode = $("week");
let dateNode = $("date");

let timeNode = $("time2");
let hourNode = $("hours");
let minNode = $("mins");
let secNode = $("secs");

let statNodes = [$("row1"), $("row2"), $("row3"), $("row4")];

let heartTimeout;
let heartLastUpdated = 0;

let heartSensor = new HeartRateSensor();

heartSensor.onreading = () => {
  heartSensor.stop();
  clearTimeout(heartTimeout);
  if(settings.heartPos >= 0) {
    statNodes[settings.heartPos].text = heartSensor.heartRate;
  }
};

heartSensor.onerror = () => {
  heartSensor.stop();
  clearTimeout(heartTimeout);
  onHeartTimeout();
};

function onHeartTimeout() {
  if(settings.heartPos >= 0) {
    statNodes[settings.heartPos].text =  "-" + user.restingHeartRate + "-";
  }
}

function onTick(now) {
  now = (now && now.date) || new Date();

  dateNode.text = now.getDate();
  weekNode.text = weekNames[now.getDay()];
  battNode.text = battery.chargeLevel + "%";
  
  let mins = now.getMinutes();
  let hrs = now.getHours();
  hourNode.groupTransform.rotate.angle = ((hrs % 12) + mins/60)*30;
  minNode.groupTransform.rotate.angle = mins*6;
  secNode.groupTransform.rotate.angle = now.getSeconds()*6;
  
  timeNode.text = ((HOUR12 && hrs > 12) ? hrs % 12 : hrs) + ":" + pad(mins);

  let today = health.today.adjusted;

  for(let i = 0; i < statNodes.length; i++) {
    if(settings.stat[i] > 0) {  //any stat except the heart rate
      statNodes[i].text = getStat(today, settings.stat[i]);
    }
  }

  if(settings.heartPos >= 0 && now - heartLastUpdated > 1600) {  //no need to poll the heart more than once every 2 seconds (1.6s to allow for onTick deviation)
    heartLastUpdated = now;

    if(!heartSensor.activated) {
      heartTimeout = setTimeout(onHeartTimeout, 500);
      heartSensor.start();
    }
  }
}

clock.granularity = "seconds";
clock.ontick = onTick;

function init() {
  //position the non-meridian hour markers programatically
  let box = $("markers").getBBox();
  let height = box.height/2;
  let width = box.width/2;

  let n, angle = 1*Math.PI/6;  //1, 5, 7, 11 o'clock

  let x = Math.tan(angle)*height;
  if(x > width) {  //currently doesn't get called on the current hard-coded box size
    let y = width/Math.tan(angle);
    n = $("mark1");
    n.cx = width*2;
    n.cy = height - y;
    n = $("mark5");
    n.cx = width*2;
    n.cy = height + y;
    n = $("mark7");
    n.cx = 0;
    n.cy = height + y;
    n = $("mark11");
    n.cx = 0;
    n.cy = height - y;
  } else {
    n = $("mark1");
    n.cx = width + x;
    n.cy = 0;
    n = $("mark5");
    n.cx = width + x;
    n.cy = height*2;
    n = $("mark7");
    n.cx = width - x;
    n.cy = height*2;
    n = $("mark11");
    n.cx = width - x;
    n.cy = 0;
  }

  angle = 2*Math.PI/6;  //2, 4, 8, 10 o'clock

  let x = Math.tan(angle)*height;
  if(x > width) {
    let y = width/Math.tan(angle);
    n = $("mark2");
    n.cx = width*2;
    n.cy = height - y;
    n = $("mark4");
    n.cx = width*2;
    n.cy = height + y;
    n = $("mark8");
    n.cx = 0;
    n.cy = height + y;
    n = $("mark10");
    n.cx = 0;
    n.cy = height - y;
  } else {  //currently doesn't get called on the current hard-coded box size
    n = $("mark2");
    n.cx = width + x;
    n.cy = 0;
    n = $("mark4");
    n.cx = width + x;
    n.cy = height*2;
    n = $("mark8");
    n.cx = width - x;
    n.cy = height*2;
    n = $("mark10");
    n.cx = width - x;
    n.cy = 0;
  }

  //see if we have a background image defined
  try {
    bkgdFile = fs.readFileSync("bkgd.txt", "cbor");
  } catch(e) {}
  if(bkgdFile) {
    bkgdNode.href = "/private/data/" + bkgdFile;
    bkgdNode.style.display = "inline";
  }

  pendingFiles();
  loadFile("settings.txt");
  onTick();
}

inbox.onnewfile = pendingFiles;
init();

function getStat(h, i) {
  switch(i) {
    case 1: return h.steps;
    case 2: 
      let mins = h.activeMinutes;
      return Math.floor(mins/60) + "'" + pad(mins % 60);
    case 3: return h.elevationGain;
    case 4: return METRIC ? round(h.distance/1000) : round(h.distance/1609.34);
    case 5: return h.calories;  //not used
  }
}

function pendingFiles() {
  let exists = false;
  let tmp;
  while(tmp = inbox.nextFile()) {
    exists = true;
    loadFile(tmp);
  }
  if(exists) {
    vibration.start("bump");
    display.poke();   
  }
}

function loadFile(name) {
  if(name.substr(-4) === ".jpg") {  //any image file is assumed a background image
    if(bkgdFile) {
      //delete the old background image
      fs.unlinkSync(bkgdFile);
      fs.unlinkSync("bkgd.txt");
    }
    bkgdFile = name.replace(".jpg", ".txi");
    jpeg.decodeSync(name, bkgdFile, {"delete": true, overwrite: true});
    try {
      fs.writeFileSync("bkgd.txt", encode(bkgdFile));  //write the name of the image file into "bkgd.txt"
    } catch(e) {
      console.log(e);
    }
    bkgdNode.href = "/private/data/" + bkgdFile;
    bkgdNode.style.display = "inline";

  } else {

    let obj;
    try {  //assume all other files are JS objects
      obj = fs.readFileSync(name, "cbor");
    } catch(e) {
      return;  //only continue further if the file exists
    }

    if(name === "settings.txt") {
      for(let i in obj) settings[i] = obj[i];
      $("stats").style.opacity = settings.showStats*1/100;
      $("markers").style.opacity = settings.showMarker*1/100;
      $("corners").style.opacity = settings.showCorner*1/100;      
    }
  }
}

peer.onmessage = ({data}) => {
  if(data && data.noBkgd) {
    if(bkgdFile) {
      fs.unlinkSync(bkgdFile);
      fs.unlinkSync("bkgd.txt");
      bkgdFile = "";
      bkgdNode.style.display = "none";
      vibration.start("bump");
      display.poke();
    }
  }
};
