import EventEmitter from 'eventemitter3';

import ApplicationMonitor from './application';
import PlayerMonitor from './player';


export default class Monitor extends EventEmitter {
    constructor(service) {
        super();

        this.service = service;

        this.appMountPoint = null;

        // Initialize children
        this.application = new ApplicationMonitor(this);
        this.player = new PlayerMonitor(this);
    }

    bind(document) {
        return new Promise((resolve, reject) => {
            let retries = 0,
                run = () => {
                    this.appMountPoint = document.querySelector('#appMountPoint');

                    if(this.appMountPoint !== null) {
                        // Initial application update
                        this.application.update();

                        // Fire event
                        this.emit('bound', this.appMountPoint);

                        // Resolve promise
                        return resolve(this.appMountPoint);
                    }

                    // Unable to find the "#appMountPoint" element
                    console.warn('Unable to find the "#appMountPoint" element, will try again in 500ms');

                    if(retries < 10) {
                        retries++;
                        return setTimeout(run, 500);
                    }

                    return reject(new Error('Unable to find application mount point'));
                };

            run();
        });
    }
}
