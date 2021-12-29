load('api_config.js');
load('api_gcp.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_pwm.js');
load('api_sys.js');
load('api_rpc.js');

let topicsubconfig = '/devices/' + Cfg.get('device.id') + '/config';
let topicsubcommand = '/devices/' + Cfg.get('device.id') + '/commands';
let topicsubcommandreset = '/devices/' + Cfg.get('device.id') + '/commands/reset';
let topicpubstate = '/devices/' + Cfg.get('device.id') + '/state';
let topicpubevents = '/devices/' + Cfg.get('device.id') + '/events/fan';

let speed = Cfg.get('app.pwm.val');
let oldspeed = Cfg.get('app.old.speed');
let speedpwm = 50;
let mqttconnection = true;
let mqttconnectionnew = true;

if (Cfg.get('app.pwm.gra')){
  //speedpwm=50+12*speed;
  if (oldspeed===0){
    speedpwm=50;
  }
  if (oldspeed===1){
    speedpwm=72;
  }
  if (oldspeed===2){  
    speedpwm=83;
  }  
  if (oldspeed===3){
    speedpwm=87;
  }
  if (oldspeed===4){
    speedpwm=91;
  }
}else{
  //speedpwm=50-12*speed;
  if (oldspeed===0){
    speedpwm=50;
  }
  if (oldspeed===1){
    speedpwm=26;
  }
  if (oldspeed===2){
    speedpwm=14;
  }
  if (oldspeed===3){
    speedpwm=9;
  }
  if (oldspeed===4){
    speedpwm=4;
  }
};

print(speedpwm);
mqttconnectionnew = MQTT.isConnected();
if (mqttconnectionnew === true){
  if (mqttconnection === false){
    let msg = JSON.stringify({type: "startupfan", userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
    print(topicpubstate, '->', msg);
    MQTT.pub(topicpubstate, msg, 1);
    print ("Objavi podatek na server ker je povezava nazaj --> MQTT connectionnew je: ", mqttconnectionnew);
    mqttconnection = mqttconnectionnew;
  } else {
    print ("MQTT povezava je vseskozi aktivna");
    mqttconnection = mqttconnectionnew;
  }
} else {
  print ("Trenutna MQTT povezava je padla");
  mqttconnection = mqttconnectionnew;
};


let oldtimer = Timer.set(Cfg.get('app.pwm.time'), true, function() {
  speedpwm = 99-speed-speedpwm;
  print("PWM set to initial speed:", speedpwm);
  PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
  mqttconnectionnew = MQTT.isConnected();
  if (mqttconnectionnew === true){
    if (mqttconnection === false){
      let msg = JSON.stringify({type: "startupfan", userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
      print(topicpubstate, '->', msg);
      MQTT.pub(topicpubstate, msg, 1);
      print ("Objavi podatek na server ker je povezava nazaj --> MQTT connectionnew je: ", mqttconnectionnew);
      mqttconnection = mqttconnectionnew;
    } else {
      print ("MQTT povezava je vseskozi aktivna");
      mqttconnection = mqttconnectionnew;
    }
  } else {
    print ("Trenutna MQTT povezava je padla");
    mqttconnection = mqttconnectionnew;
  }
}, null);
 
MQTT.sub(topicsubconfig, function(conn, topic, msg) {
  //{“userId”: "usernew", “name”: ”my-fan”, “nightFan”: ”true”, “groupA”: ”false”, "maxNightSpeed":2}
  let obj = JSON.parse(msg) || {};
  Cfg.set({app: {user: obj.userId}});
  Cfg.set({app: {name: obj.name}});
  Cfg.set({app: {pwm: {night: obj.nightFan}}});
  Cfg.set({app: {pwm: {gra: obj.groupA}}});
  Cfg.set({app: {night: {speed: obj.maxNightSpeed}}});
  print ("User: ", Cfg.get('app.user'), "  Name ", Cfg.get('app.name'), "  Nightfan ", Cfg.get('app.pwm.night'), "  groupA ", Cfg.get('app.pwm.gra'),  " maxNightSpeed ", Cfg.get('app.night.speed'));
 }, null);

 MQTT.sub(topicsubcommand, function(conn, topic, msg) {
//  {“speed”: 2, “auto”: false, “boost”: false, “night”: false, “summer”: false, "boostCountDown":3600000}
  let obj = JSON.parse(msg) || {};
  Cfg.set({app: {pwm: {val: obj.speed}}});
  print ("Speed: ", obj.speed, "Auto ", obj.auto, "Boost ", obj.boost, "Night ", obj.night, "Summer ", obj.summer, "Countdown", obj.boostCountDown);

// pogoji načinov delovanja 
// ce je mode:summer nastavi app.pwm.time na 1 uro sicer pusti na 70s
  if (obj.summer){
    Cfg.set({app: {pwm: {time: 3600000}}});
    print("Change over time set to ", Cfg.get('app.pwm.time'));
  } else {
    Cfg.set({app: {pwm: {time: 70000}}});
    print("Change over time set to ", Cfg.get('app.pwm.time'));
  };

// shrani prejšnjo hitrost preden je bil boost
  if (!obj.boost){
    Cfg.set({app: {old: {speed: obj.speed}}});
    print("Oldspeed set to ", Cfg.get('app.old.speed'));
  };
  if (obj.boost){
     // postavitev hitrosti na 4 v bazi podatkov ce je izbran boost 
      speed = 4; 
      oldspeed = Cfg.get('app.old.speed');
      Cfg.set({app: {boost: {time: obj.boostCountDown}}});
      print ("Set oldsped: ", oldspeed, "Set countdown: ", Cfg.get('app.boost.time'));

      if (Cfg.get('app.pwm.val') !== 4) {
        print ("Postavi hitrost na 4 na events/fan: ", speed);
        let msg = JSON.stringify({userId: Cfg.get('app.user'), boost: obj.boost, speed: speed});
        print(topicpubevents, '->', msg);
        MQTT.pub(topicpubevents, msg, 1);
      }
      if (Cfg.get('app.pwm.gra')){
        //speedpwm=50+12*speed;
        if (oldspeed===0){
          speedpwm=50;
        }
        if (oldspeed===1){
          speedpwm=72;
        }
        if (oldspeed===2){  
          speedpwm=83;
        }  
        if (oldspeed===3){
          speedpwm=87;
        }
        if (oldspeed===4){
          speedpwm=91;
        }
      }else{
        //speedpwm=50-12*speed;
        if (oldspeed===0){
          speedpwm=50;
        }
        if (oldspeed===1){
          speedpwm=26;
        }
        if (oldspeed===2){
          speedpwm=14;
        }
        if (oldspeed===3){
          speedpwm=9;
        }
        if (oldspeed===4){
          speedpwm=4;
        }
      };

      // one time timer to set boost to false and set back oldspeed
      let boosttimer = Timer.set(Cfg.get('app.boost.time'), false, function() {
        speedpwm = 99-oldspeed-speedpwm;
        print("Boost time ended. Setting BOOST OFF AND speed back to previous speed:", oldspeed);
        let msg = JSON.stringify({userId: Cfg.get('app.user'), boost: false, speed: oldspeed});
        print(topicpubevents, '->', msg);
        MQTT.pub(topicpubevents, msg, 1);
      }, null);


  }else{
    if (obj.night){
      if (Cfg.get('app.pwm.night')){
        if (obj.speed > Cfg.get('app.night.speed')){
          speed = Cfg.get('app.night.speed');
        }else{
          speed = obj.speed;
        }
      }else{
        speed = obj.speed;
      }
    }else{
      speed = obj.speed;
    };
  };
//konec pogojev za fan
// določitev hitrosti ventilatorja glede na groupA - A ali B ventilator
if (Cfg.get('app.pwm.gra')){
  //speedpwm=50+12*speed;
  if (speed===0){
    speedpwm=50;
  }
  if (speed===1){
    speedpwm=72;
  }
  if (speed===2){
    speedpwm=83;
  }
  if (speed===3){
    speedpwm=87;
  }
  if (speed===4){
    speedpwm=91;
  }
}else{
  //speedpwm=50-12*speed;
  if (speed===0){
    speedpwm=50;
  }
  if (speed===1){
    speedpwm=26;
  }
  if (speed===2){
    speedpwm=14;
  }
  if (speed===3){
    speedpwm=9;
  }
  if (speed===4){
    speedpwm=4;
  }
};

  Timer.del(oldtimer);
  let tm = Timer.now();
  let msg = JSON.stringify({type: "fan", userId: Cfg.get('app.user'), time: tm, currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
  print(topicpubstate, '->', msg);
  MQTT.pub(topicpubstate, msg, 1);
  // objavi in takoj postavi na novo hitrost
  print("PWM set to config speed:", speedpwm);
  PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);  
  //starta timer ki se ponavlja z zakasnitvijo
  let newtimer = Timer.set(Cfg.get('app.pwm.time'), Timer.REPEAT, function() {
    speedpwm = 99-speed-speedpwm;
    print("PWM set to config speed:", speedpwm);
    PWM.set(Cfg.get('app.pin'), 1000, speedpwm/100);
    mqttconnectionnew = MQTT.isConnected();
    if (mqttconnectionnew === true){
      if (mqttconnection === false){
        let msg = JSON.stringify({type: "startupfan", userId: Cfg.get('app.user'), currentFanSpeed: speed, timeChangeDirection: Cfg.get('app.pwm.time')});
        print(topicpubstate, '->', msg);
        MQTT.pub(topicpubstate, msg, 1);
        print ("Objavi podatek na server ker je povezava nazaj --> MQTT connectionnew je: ", mqttconnectionnew);
        mqttconnection = mqttconnectionnew;
      } else {
        print ("MQTT povezava je vseskozi aktivna");
        mqttconnection = mqttconnectionnew;
      }
    } else {
      print ("Trenutna MQTT povezava je padla");
      mqttconnection = mqttconnectionnew;
    }

  }, null);
  oldtimer = newtimer;
//konec MQTT.sub
 }, null);

 // reset modula nazaj na ap ko se zbriše baza oz. dobi sporocil {"reset"=true na commands subfolder reset}
 MQTT.sub(topicsubcommandreset, function(conn, topic, msg) {
    // {"reset":true}
    let obj = JSON.parse(msg) || {};
    print('Dobil sporocilo za reset');
    Cfg.set({wifi: {sta: {enable: false}}});
    Cfg.set({wifi: {sta: {ssid: ""}}});
    Cfg.set({wifi: {sta: {pass: ""}}});
    Cfg.set({wifi: {ap: {enable: true}}});
    Sys.reboot(10000);    
  }, null);


