import {device} from "peer";
import {settingsStorage as storage} from "settings";
import {outbox} from "file-transfer";
import {Image} from "image";
import {me} from "companion";
import {encode} from "cbor";
import {peerSocket as peer} from "messaging";

//required for settings image upload
storage.setItem("screenWidth", device.screen.width);
storage.setItem("screenHeight", device.screen.height);

var settings = {
  showStats: null,
  showMarker: null,
  showCorner: null
};

function init() {
  for(let n in settings) {
    let v = storage.getItem(n);
    if(v !== null && v !== undefined) settings[n] = v;
  }

  if(me.launchReasons.settingsChanged) {
    //the settings page changed something before the companion app
    //started. We have to assume everything changed.
    onBackgroundChanged(storage.getItem("bkgd"));
    onConfigChanged();
  }
}
init();

storage.onchange = e => {
  let n = e.key;

  if(n === "bkgd") {
    onBackgroundChanged(e.newValue);

  } else if(n in settings) {
    settings[n] = e.newValue;
    onConfigChanged();
  }
}

let configTimer;

function onConfigChanged() {
  clearTimeout(configTimer);
  //push settings to the watch on a timer because the slider component fires too frequently
  configTimer = setTimeout(() => {
    let obj = {};
    for(let n in settings) {
      if(settings[n] !== null && settings[n] !== undefined) obj[n] = settings[n];
    }
    outbox.enqueue("settings.txt", encode(obj));
  }, 700);
}

function onBackgroundChanged(img) {
  if(img) {
    //we give it a new name each time because the watch's image component will
    //cache the image data if the file name is the same unless the watch app is restarted
    Image.from(JSON.parse(img).imageUri)
      .then(img => img.export("image/jpeg"))
      .then(buf => outbox.enqueue(Math.round(Math.random()*1000) + ".jpg", buf));
  } else {
    if(peer.readyState === peer.OPEN) {
      peer.send({noBkgd: 1});
    } else {
      let pend = true;
      peer.onopen = () => {
        if(pend) peer.send({noBkgd: 1});
        pend = false;
      };
    }
  }  
}
