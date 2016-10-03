import EventEmitter from 'eventemitter3';


export default class PlayerMonitor extends EventEmitter {
    constructor(main) {
        super();

        this.main = main;
        this.service = main.service;
        this.plugin = main.service.plugin;

        this.videoId = null;
        this.videoElement = null;
        this.videoListeners = {};

        // Bind to application events
        this.main.application.on('navigate.from', (path) => this._onNavigateFrom(path));
        this.main.application.on('navigate.to', (path) => this._onNavigateTo(path));
    }

    initialize() {
        console.debug('Initializing player monitor');

        this.videoElement = null;

        // Construct mutation observer
        this.observer = new MutationObserver(
            (mutations) => this._onMutations(mutations)
        );
    }

    dispose() {
        console.debug('Disposing player monitor');

        // Disconnect mutation observer
        this.observer.disconnect();
        this.observer = null;

        // Unbind player events
        this._unbind();

        // Emit player "close" event
        this.emit('close');
    }

    // region Video player events

    _addEventListener(type, listener) {
        if(!this.videoElement) {
            return false;
        }

        // Add event listener
        console.debug('Adding event listener %o for type %o', listener, type);
        this.videoElement.addEventListener(type, listener);

        // Store listener reference
        if(typeof this.videoListeners[type] === 'undefined') {
            this.videoListeners[type] = [];
        }

        this.videoListeners[type].push(listener);
        return true;
    }

    _removeEventListeners() {
        if(!this.videoElement) {
            return false;
        }

        for(let type in this.videoListeners) {
            if(!this.videoListeners.hasOwnProperty(type)) {
                continue;
            }

            let listeners = this.videoListeners[type];

            for(let i = 0; i < listeners.length; ++i) {
                let listener = listeners[i];

                console.debug('Removing event listener %o for type %o', listener, type);
                this.videoElement.removeEventListener(type, listener);
            }
        }

        return true;
    }

    _bind(video) {
        console.debug('Binding to video element: %o', video);

        // Update state
        this.videoElement = video;

        // Bind player events
        this._addEventListener('playing', () => this.emit('playing'));
        this._addEventListener('pause', () => this.emit('paused'));
        this._addEventListener('ended', () => this.emit('ended'));

        this._addEventListener('timeupdate', () => {
            let time = this._getPlayerTime();
            let duration = this._getPlayerDuration();

            this.emit(
                'progress',
                this._calculateProgress(time, duration),
                time,
                duration
            );
        });
    }

    _unbind() {
        console.debug('Unbinding from video element: %o', this.videoElement);

        // Unbind player events
        if(this.videoElement !== null) {
            this._removeEventListeners();
        }

        // Reset state
        this.videoElement = null;
    }

    // endregion

    // region Event handlers

    _onMutations(mutations) {
        for(let i = 0; i < mutations.length; ++i) {
            this._onMutation(mutations[i]);
        }
    }

    _onMutation(mutation) {
        if(mutation.type === 'childList') {
            this._onMutationActions('add', mutation.addedNodes);
            this._onMutationActions('remove', mutation.removedNodes);
        }
    }

    _onMutationActions(action, nodes) {
        for(let i = 0; i < nodes.length; ++i) {
            let node = nodes[i];

            if(node.tagName !== 'VIDEO') {
                return;
            }

            this._onVideoMutationAction(action, node);
        }
    }

    _onVideoMutationAction(action, node) {
        if(action === 'add') {
            // Bind to video events
            this._bind(node);

            // Video loaded
            this._onVideoLoaded();
        } else if(action === 'remove') {
            this._unbind();
        }
    }

    _onNavigateFrom(path) {
        if(!path.startsWith('/watch')) {
            return;
        }

        // Dispose player monitor
        this.dispose();
    }

    _onNavigateTo(path) {
        if(!path.startsWith('/watch')) {
            return;
        }

        // Initialize player monitor
        this.initialize();

        // Observe player changes
        this.observer.observe(this.main.appMountPoint, {
            childList: true,
            subtree: true
        });
    }

    _onVideoLoaded() {
        let path = location.pathname;

        // Retrieve video key
        let videoId = path.substring(path.lastIndexOf('/') + 1);

        if(!videoId || videoId.length < 1) {
            return;
        }

        // Emit "open" event
        if(videoId !== this.videoId) {
            this.videoId = videoId;

            // Emit event
            this.emit('open', parseInt(videoId, 10));
        }
    }

    // endregion

    // region Helpers

    _round2(num) {
        return +(Math.round(num + 'e+2') + 'e-2');
    }

    _getPlayerDuration() {
        if(this.videoElement === null || this.videoElement.duration === 0) {
            return null;
        }

        return this.videoElement.duration * 1000;
    }

    _getPlayerTime() {
        if(this.videoElement === null || this.videoElement.duration === 0) {
            return null;
        }

        return this.videoElement.currentTime * 1000;
    }

    _calculateProgress(time, duration) {
        return this._round2((parseFloat(time) / duration) * 100);
    }

    // endregion
}
