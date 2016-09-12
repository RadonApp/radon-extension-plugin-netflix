export class NetflixShim {
    start() {
        // Listen for shim requests
        document.body.addEventListener('eon.request', (e) => this._onRequestReceived(e));

        // Emit "ready" event
        this.emit('ready');
    }

    emit(type, data) {
        // Construct event
        var event = new CustomEvent('eon.event', {
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

        var id = e.detail.id;
        var type = e.detail.type;

        // Process request
        if(type === 'serverDefs') {
            return this.resolve(id, netflix.reactContext.models.serverDefs.data);
        }

        // Unknown request
        console.warn('Received unknown "' + type + '" request');
        return this.reject(id);
    }
}

// Initialize shim
(new NetflixShim()).start();
