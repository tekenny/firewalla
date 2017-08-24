/*    Copyright 2016 Firewalla LLC
 *
 *    This program is free software: you can redistribute it and/or  modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';

let log = require('../net2/logger.js')(__filename);

let Bone = require('../lib/Bone');

let Sensor = require('./Sensor.js').Sensor;

let serviceConfigKey = "bone:service:config";

let syncInterval = 1000 * 3600; // sync hourly
let redis = require('redis');
let rclient = redis.createClient();
let Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);

let SysManager = require('../net2/SysManager.js');
let sysManager = new SysManager('info');

let async = require('asyncawait/async');
let await = require('asyncawait/await');

let License = require('../util/license');

let fConfig = require('../net2/config.js').getConfig();

let sem = require('../sensor/SensorEventManager.js').getInstance();

class BoneSensor extends Sensor {
  scheduledJob() {
    Bone.waitUtilCloudReady(() => {
      this.checkIn()
        .then(() => {})
        .catch((err) => {
        log.error("Failed to check in", err, {});
        })

    })
  }

  checkIn() {
    let license = License.getLicense();

    if(!license) {
      log.error("License file is required!");
      // return Promise.resolve();
    }

    return async(() => {
      let sysInfo = await (sysManager.getSysInfoAsync());

      log.info("Checking in Cloud...");

      let data = await (Bone.checkinAsync(fConfig, license, sysInfo));

      log.info("Cloud checked in successfully:", JSON.stringify(data));

      await (rclient.setAsync("sys:bone:info",JSON.stringify(data)));

      let existingDDNS = await (rclient.hgetAsync("sys:network:info", "ddns"));
      if (data.ddns) {
        sysManager.ddns = data.ddns;
        await (rclient.hsetAsync(
          "sys:network:info",
          "ddns",
          JSON.stringify(data.ddns))); // use JSON.stringify for backward compatible
      }

      let existingPublicIP = await (rclient.hgetAsync("sys:network:info", "publicIp"));
      if(data.publicIp) {
        sysManager.publicIp = data.publicIp;
        await (rclient.hsetAsync(
            "sys:network:info",
            "publicIp",
            JSON.stringify(data.publicIp))); // use JSON.stringify for backward compatible
      }

      // broadcast new change
      if(existingDDNS !== JSON.stringify(data.ddns) ||
      existingPublicIP !== JSON.stringify(data.publicIp)) {
        sem.emitEvent({
          type: 'DDNS:Updated',
          toProcess: 'FireApi',
          publicIp: data.publicIp,
          ddns: data.ddns,
          message: 'DDNS is updated'
        })
      }
    })();
  }

  run() {
    setTimeout(() => {
      this.scheduledJob();
    }, 5 * 1000); // in 5 seconds

    setInterval(() => {
      this.scheduledJob();
    }, syncInterval);
  }

  // make config redis-friendly..
  flattenConfig(config) {
    let sConfig = {};

    let keys = ["adblock.dns", "family.dns"];

    keys.filter((key) => config[key]).forEach((key) => {
      if (config[key].constructor.name === 'Object' ||
        config[key].constructor.name === 'Array') {
        sConfig[key] = JSON.stringify(config[key]);
      } else {
        sConfig[key] = config[key];
      }
    })

    return sConfig;
  }

  loadServiceConfig() {
    log.info("Loading service config from cloud...");
    Bone.getServiceConfig((err, config) => {

      if(config && config.constructor.name === 'Object') {
        rclient.hmsetAsync(serviceConfigKey, this.flattenConfig(config))
          .then(() => {
            log.info("Service config is updated");
          }).catch((err) => {
          log.error("Failed to store service config in redis:", err, {});
        })
      }
    })
  }
}

module.exports = BoneSensor;