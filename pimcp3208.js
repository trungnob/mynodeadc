
module.exports = function(RED) {
    "use strict";
    var fs = require('fs');
    // unlikely if not on a Pi
    try {
        var cpuinfo = fs.readFileSync("/proc/cpuinfo").toString();
        if (cpuinfo.indexOf(": BCM") === -1) { throw "Info : "+RED._("rpi-gpio.errors.ignorenode"); }
    } catch(err) {
        throw "Info : "+RED._("rpi-gpio.errors.ignorenode");
    }

    var mcpadc = require('mcp-spi-adc');
    var mcp3208 = [];

    function PiMcpNode(n) {
        RED.nodes.createNode(this,n);
        this.pin = n.pin || 0;
        this.interval = n.interval || 1000;
        this.dnum = parseInt(n.dnum || 0);
        var node = this;

        try {
            fs.statSync("/dev/spidev0."+node.dnum);
            if (mcp3208.length === 0) {
                for (var i=0; i<8; i++) {
                    mcp3208.push(mcpadc.openMcp3208(i, { deviceNumber:node.dnum }, function (err) {
                        if (err) { node.error("Error: "+err); }
                    }));
                }
            }
            node.on("input", function(msg) {
                var pin = null;
                var valueData=[]
                var max =-1;
                var min=4098;
                var N=1000;
                if (node.pin === "M") {
                    var pay = parseInt(msg.payload.toString());
                    if ((pay >= 0) && (pay <= 7)) { pin = pay; }
                    else { node.warn("Payload needs to select channel 0 to 7"); }
                }
                else { pin = parseInt(node.pin); }
                if (pin !== null) {
                  for(var i =0 ; i < N ; i++){
                    mcp3208[pin].read(function (err, reading) {
                        //console.log(N);
                        if (err) 
                        { 
                          node.warn("Read error: "+err);
                          return; 
                        }
                        if (reading.rawValue > max)
                        {
                          max = reading.rawValue;
                        }
                        if (reading.rawValue<min)
                        {
                          min = reading.rawValue;
                        }
                        if (N<=1)
                        {
                          // console.log('done');
                          node.send({payload:[max,min],topic:"Max Min at adc/"+pin});
                          return;
                        }
                        --N;
                        //console.log(max);
                       // else 
                        //{ 
                          //node.send({payload:reading.rawValue, topic:"adc/"+pin}); 
                        //}
                    });
                  }
                  //node.send({payload:[max], topic:"adc/"+pin});
                }
            });

        }
        catch(err) {
            node.error("Error : Can't find SPI device - is SPI enabled in raspi-config ?");
        }

        node.on("close", function(done) {
            if (mcp3208.length !== 0) {
                var j=0;
                for (var i=0; i<8; i++) {
                    mcp3208[i].close(function() { j += 1; if (j === 8) {done()} });
                }
                mcp3208 = [];
            }
            else { done(); }
        });
    }

    RED.nodes.registerType("pimcp3208",PiMcpNode);
}
