/* eslint-disable no-multi-spaces, key-spacing */
import EventEmitter from 'eventemitter3';
import IsNil from 'lodash-es/isNil';

import Log from 'neon-extension-source-netflix/core/logger';


export default class PlayerObserver extends EventEmitter {
    constructor() {
        super();

        this._video = null;
        this._videoListeners = {};

        this._observer = null;
    }

    bind(mountPoint) {
        // Construct observer
        this._observer = new MutationObserver(
            (mutations) => this._onMutations(mutations)
        );

        // Observe mount point for changes
        this._observer.observe(mountPoint, {
            childList: true,
            subtree: true
        });

        return Promise.resolve();
    }

    dispose() {
        Log.debug('Disposing player monitor');

        // Disconnect mutation observer
        if(!IsNil(this._observer)) {
            this._observer.disconnect();
            this._observer = null;
        }

        // Unbind player events
        this._unbind();

        // Emit player "close" event
        this.emit('closed');
    }

    getDuration() {
        if(this._video === null || this._video.duration === 0) {
            return null;
        }

        return this._video.duration * 1000;
    }

    getTime() {
        if(this._video === null || this._video.duration === 0) {
            return null;
        }

        return this._video.currentTime * 1000;
    }

    // region Video player events

    _addEventListener(type, listener) {
        if(!this._video) {
            return false;
        }

        // Add event listener
        Log.debug('Adding event listener %o for type %o', listener, type);
        this._video.addEventListener(type, listener);

        // Store listener reference
        if(typeof this._videoListeners[type] === 'undefined') {
            this._videoListeners[type] = [];
        }

        this._videoListeners[type].push(listener);
        return true;
    }

    _removeEventListeners() {
        if(!this._video) {
            return false;
        }

        for(let type in this._videoListeners) {
            if(!this._videoListeners.hasOwnProperty(type)) {
                continue;
            }

            let listeners = this._videoListeners[type];

            for(let i = 0; i < listeners.length; ++i) {
                let listener = listeners[i];

                Log.debug('Removing event listener %o for type %o', listener, type);
                this._video.removeEventListener(type, listener);
            }
        }

        return true;
    }

    _bind(video) {
        Log.debug('Binding to video element: %o', video);

        // Update state
        this._video = video;

        // Bind player events
        this._addEventListener('loadstart',         () => this.emit('loading'));
        this._addEventListener('loadedmetadata',    () => this.emit('loaded'));

        this._addEventListener('playing',           () => this.emit('started'));
        this._addEventListener('pause',             () => this.emit('paused'));
        this._addEventListener('ended',             () => this.emit('stopped'));

        this._addEventListener('seeked', () => {
            this.emit('seeked', this.getTime(), this.getDuration());
        });

        this._addEventListener('timeupdate', () => {
            this.emit('progress', this.getTime(), this.getDuration());
        });
    }

    _unbind() {
        Log.debug('Unbinding from video element: %o', this._video);

        // Unbind player events
        if(this._video !== null) {
            this._removeEventListeners();
        }

        // Reset state
        this._video = null;
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
            this.emit('opened');
        } else if(action === 'remove') {
            this._unbind();
        }
    }
}
