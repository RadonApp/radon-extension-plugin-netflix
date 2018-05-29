/* eslint-disable no-multi-spaces, key-spacing */
import EventEmitter from 'eventemitter3';
import IsEqual from 'lodash-es/isEqual';
import IsNil from 'lodash-es/isNil';
import Map from 'lodash-es/map';

import ApplicationObserver from 'neon-extension-source-netflix/Application/Observer';
import Log from 'neon-extension-source-netflix/Core/Logger';
import Observer from 'neon-extension-source-netflix/Base/Observer';


export class PlayerVideoObserver extends EventEmitter {
    constructor() {
        super();

        this._listeners = {};
        this._node = null;
    }

    // region Public Methods

    start(node) {
        if(!IsNil(this._node)) {
            this.stop();
        }

        Log.trace('Observing video: %o', node);

        // Update state
        this._node = node;

        // Bind events
        this._addEventListener('loadstart',         () => this.emit('loading'));
        this._addEventListener('loadedmetadata',    () => this.emit('loaded'));

        this._addEventListener('playing',           () => this.emit('started'));
        this._addEventListener('pause',             () => this.emit('paused'));
        this._addEventListener('ended',             () => this.emit('stopped'));

        // TODO Duration should be emitted separately
        this._addEventListener('seeked',            () => this.emit('seeked', this._getTime()));
        this._addEventListener('timeupdate',        () => this.emit('progress', this._getTime()));

        // Emit "loading" event
        this.emit('loading');

        // Emit "loaded" event (if already loaded)
        if(this._node.readyState >= 2) {
            this.emit('loaded');
        }

        return true;
    }

    stop() {
        if(IsNil(this._node)) {
            return false;
        }

        Log.trace('Stopped observing video');

        // Unbind events
        this._removeEventListeners();

        // Update state
        this._node = null;

        return true;
    }

    getDuration() {
        if(IsNil(this._node) || this._node.duration === 0) {
            return null;
        }

        return this._node.duration * 1000;
    }

    // endregion

    // region Private Methods

    _getTime() {
        if(IsNil(this._node) || this._node.currentTime === 0) {
            return null;
        }

        return this._node.currentTime * 1000;
    }

    _addEventListener(type, listener) {
        if(IsNil(this._node)) {
            return false;
        }

        Log.trace('Listening for video %o events', type);

        // Add event listener
        this._node.addEventListener(type, listener);

        // Store listener reference (for later cleanup)
        if(IsNil(this._listeners[type])) {
            this._listeners[type] = [];
        }

        this._listeners[type].push(listener);

        return true;
    }

    _removeEventListeners() {
        if(IsNil(this._node)) {
            return false;
        }

        for(let type in this._listeners) {
            if(!this._listeners.hasOwnProperty(type)) {
                continue;
            }

            let listeners = this._listeners[type];

            for(let i = 0; i < listeners.length; ++i) {
                let listener = listeners[i];

                Log.trace('Stopped listening for video %o events', type);

                // Remove event listener
                this._node.removeEventListener(type, listener);
            }

            // Create new array
            this._listeners[type] = [];
        }

        return true;
    }

    // endregion
}

export class PlayerObserver extends Observer {
    constructor() {
        super();

        this.player = null;
        this.controls = null;
        this.info = null;

        this.title = null;
        this.subtitle = null;

        // Private attributes
        this._currentTitle = null;
        this._currentSubtitles = null;

        // Create video observer
        this._videoObserver = new PlayerVideoObserver();

        this._videoObserver.on('loading',   this.emit.bind(this, 'loading'));
        this._videoObserver.on('loaded',    this.emit.bind(this, 'loaded'));

        this._videoObserver.on('started',   this.emit.bind(this, 'started'));
        this._videoObserver.on('paused',    this.emit.bind(this, 'paused'));
        this._videoObserver.on('stopped',   this.emit.bind(this, 'stopped'));

        this._videoObserver.on('progress',  this.emit.bind(this, 'progress'));
        this._videoObserver.on('seeked',    this.emit.bind(this, 'seeked'));
    }

    create() {
        // Ensure application observer has been started
        ApplicationObserver.start();

        // Observe player
        this.player = this.observe(ApplicationObserver.mount, '.sizing-wrapper .AkiraPlayer');
        this.controls = this.observe(this.player, '.controls');
        this.info = this.observe(this.controls, '.video-title');

        // Observe video
        this.video = this.observe(this.player, '.VideoContainer div video')
            .on('added', this.onVideoAdded.bind(this))
            .on('removed', this.onVideoRemoved.bind(this));

        // Observe title
        this.title = this.observe(this.info, 'h4', { text: true })
            .on('mutation', this.onTitleChanged.bind(this));

        // Observe subtitle
        this.subtitle = this.observe(this.info, 'div span', { text: true })
            .on('mutation', this.onSubtitleChanged.bind(this));
    }

    getDuration() {
        if(IsNil(this._videoObserver)) {
            return null;
        }

        return this._videoObserver.getDuration();
    }

    // region Event Handlers

    onVideoAdded({ node }) {
        Log.trace('Video added: %o', node);

        // Start observing video
        this._videoObserver.start(node);

        // Emit "opened" event
        this.emit('opened');
    }

    onVideoRemoved({ node }) {
        Log.trace('Video removed: %o', node);

        // Stop observing video
        this._videoObserver.stop();

        // Emit "closed" event
        this.emit('closed');
    }

    onTitleChanged({ event }) {
        let current = null;

        if(event === 'added') {
            current = this.title.first().innerText;
        }

        // Ensure title has changed
        if(this._currentTitle === current) {
            return;
        }

        // Retrieve previous title
        let previous = this._currentTitle;

        // Update current title
        this._currentTitle = current;

        // Emit event
        this.emit('title', { previous, current });

        // Log title change
        Log.trace('Title changed to %o', current);
    }

    onSubtitleChanged({ event }) {
        let current = null;

        if(event === 'added') {
            current = Map(this.subtitle.all(), (node) => node.innerText);
        }

        // Ensure subtitle(s) have changed
        if(IsEqual(this._currentSubtitles, current)) {
            return;
        }

        // Retrieve previous subtitle(s)
        let previous = this._currentSubtitles;

        // Update current subtitle(s)
        this._currentSubtitles = current;

        // Update application navigation
        ApplicationObserver.onNavigated();

        // Emit event
        this.emit('subtitle', { previous, current });

        // Log subtitle change
        Log.trace('Subtitle changed to %o', current);
    }

    // endregion
}

export default new PlayerObserver();
