import {isDefined} from 'eon.extension.framework/core/helpers';
import {Identifier, KeyType} from 'eon.extension.framework/models/activity/identifier';

import EventEmitter from 'eventemitter3';

import Log from '../../../core/logger';


export default class PlayerMonitor extends EventEmitter {
    constructor(main) {
        super();

        this.main = main;
        this.service = main.service;
        this.plugin = main.service.plugin;

        this._currentIdentifier = null;

        this._videoNode = null;
        this._videoListeners = {};

        // Bind to application events
        this.main.application.on('navigate.from', (path) => this._onNavigateFrom(path));
        this.main.application.on('navigate.to', (path) => this._onNavigateTo(path));
    }

    initialize() {
        Log.debug('Initializing player monitor');

        this._videoNode = null;

        // Construct mutation observer
        this.observer = new MutationObserver(
            (mutations) => this._onMutations(mutations)
        );
    }

    dispose() {
        Log.debug('Disposing player monitor');

        // Disconnect mutation observer
        this.observer.disconnect();
        this.observer = null;

        // Unbind player events
        this._unbind();

        // Emit player "close" event
        this.emit('closed', this._currentIdentifier);
    }

    // region Video player events

    _addEventListener(type, listener) {
        if(!this._videoNode) {
            return false;
        }

        // Add event listener
        Log.debug('Adding event listener %o for type %o', listener, type);
        this._videoNode.addEventListener(type, listener);

        // Store listener reference
        if(typeof this._videoListeners[type] === 'undefined') {
            this._videoListeners[type] = [];
        }

        this._videoListeners[type].push(listener);
        return true;
    }

    _removeEventListeners() {
        if(!this._videoNode) {
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
                this._videoNode.removeEventListener(type, listener);
            }
        }

        return true;
    }

    _bind(video) {
        Log.debug('Binding to video element: %o', video);

        // Update state
        this._videoNode = video;

        // Bind player events
        this._addEventListener('playing', () => this.emit('started'));
        this._addEventListener('pause', () => this.emit('paused'));
        this._addEventListener('ended', () => this.emit('stopped'));

        this._addEventListener('timeupdate', () => {
            this.emit('progress', this._getPlayerTime(), this._getPlayerDuration());
        });
    }

    _unbind() {
        Log.debug('Unbinding from video element: %o', this._videoNode);

        // Unbind player events
        if(this._videoNode !== null) {
            this._removeEventListeners();
        }

        // Reset state
        this._videoNode = null;
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
        let identifier = this._getIdentifier();

        if(!isDefined(identifier)) {
            Log.warn('Unable to retrieve video identifier');
            return;
        }

        if(identifier.matches(this._currentIdentifier)) {
            return;
        }

        // Emit "opened" event
        this.emit('opened', identifier);

        // Update state
        this._currentIdentifier = identifier;
    }

    _getIdentifier() {
        let path = location.pathname;

        // Retrieve video key
        let videoId = path.substring(path.lastIndexOf('/') + 1);

        if(!videoId || videoId.length < 1) {
            return null;
        }

        return new Identifier(
            KeyType.Unknown, parseInt(videoId, 10)
        );
    }

    _getPlayerDuration() {
        if(this._videoNode === null || this._videoNode.duration === 0) {
            return null;
        }

        return this._videoNode.duration * 1000;
    }

    _getPlayerTime() {
        if(this._videoNode === null || this._videoNode.duration === 0) {
            return null;
        }

        return this._videoNode.currentTime * 1000;
    }
}
