/* eslint-disable no-console, no-new */
/* global netflix */


export class NetflixShim {
    start() {
        // Listen for shim requests
        document.body.addEventListener('neon.request', (e) => this._onRequestReceived(e));

        // Emit "ready" event
        this.emit('ready');
    }

    emit(type, data) {
        // Construct event
        let event = new CustomEvent('neon.event', {
            detail: {
                type: type,
                data: data || null
            }
        });

        // Emit event on the document
        document.body.dispatchEvent(event);
    }

    respond(requestId, type, data) {
        this.emit('#' + requestId, {
            type: type,
            data: data || null
        });
    }

    resolve(requestId, data) {
        this.respond(requestId, 'resolve', data);
    }

    reject(requestId, data) {
        this.respond(requestId, 'reject', data);
    }

    _onRequestReceived(e) {
        if(!e || !e.detail || !e.detail.id || !e.detail.type) {
            console.error('Unknown event received:', e);
            return;
        }

        let id = e.detail.id;
        let type = e.detail.type;

        // Process request
        if(type === 'serverDefs') {
            this.resolve(id, netflix.reactContext.models.serverDefs.data);
            return;
        }

        // Unknown request
        console.warn('Received unknown "' + type + '" request');
        this.reject(id);
    }
}

// Initialize shim
(new NetflixShim()).start();
