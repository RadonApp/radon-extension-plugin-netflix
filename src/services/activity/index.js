import Extension from 'eon.extension.browser/extension';

import ActivityService from 'eon.extension.framework/services/source/activity';
import Registry from 'eon.extension.framework/core/registry';
import MessagingBus from 'eon.extension.framework/messaging/bus';
import Session, {SessionState} from 'eon.extension.framework/models/activity/session';

import Parser from './core/parser';
import MetadataApi from '../../api/metadata';
import Plugin from '../../core/plugin';
import ShimApi from '../../api/shim';
import Monitor from './monitor';

var PROGRESS_EVENT_INTERVAL = 5000;  // (in milliseconds)


export class NetflixActivityService extends ActivityService {
    constructor() {
        super(Plugin);

        this.session = null;
        this.video = null;

        this._nextSessionKey = 0;
        this._lastProgressEmittedAt = null;
        this._pauseTimeout = null;

        this.monitor = null;
    }

    initialize() {
        super.initialize();

        // Construct messaging bus
        this.bus = new MessagingBus(Plugin.id + ':activity');
        this.bus.connect('eon.extension.core:scrobble');

        // Bind to document
        this.bind();
    }

    bind() {
        if(document.body === null) {
            console.warn('Document body not loaded yet, will try again in 500ms');
            setTimeout(() => this.bind(), 500);
            return;
        }

        // Initialize activity monitor
        this.monitor = new Monitor(this);
        this.monitor.player.on('open', (videoId) => this._onOpen(videoId));
        this.monitor.player.on('close', () => this._onClose());

        this.monitor.player.on('playing', () => this._onPlaying());
        this.monitor.player.on('paused', () => this._onPaused());
        this.monitor.player.on('ended', () => this._onEnded());

        this.monitor.player.on('progress', (progress, time, duration) =>
            this._onProgress(progress, time, duration)
        );

        // Inject netflix shim
        this.inject().then(() => {
            // Bind activity monitor to document
            return this.monitor.bind(document);
        }, (error) => {
            console.error('Unable to inject shim', error);
        });
    }

    inject() {
        return new Promise((resolve, reject) => {
            // Inject scripts
            let script = this.createScript(document, '/source/netflix/shim/shim.js');

            // Bind shim api to page
            ShimApi.bind(document);

            // Wait for "ready" event
            ShimApi.once('ready', () => {
                resolve();
            });

            // TODO implement timeout?

            // Insert script into page
            (document.head || document.documentElement).appendChild(script);
        });
    }

    createScript(document, path) {
        let url = Extension.getUrl(path);

        // Create script element
        let script = document.createElement('script');

        script.src = url;
        script.onload = function() {
            this.remove();
        };

        return script;
    }

    // region Event handlers

    _onOpen(videoId) {
        console.log('Played opened (videoId: %o)', videoId);

        // Create new session
        this._createSession(videoId).then((session) => {
            // Emit "created" event
            this.bus.emit('activity.created', session.dump());
        }, (error) => {
            // Unable to create session
            console.warn('Unable to create session:', error);
        });
    }

    _onClose() {
        console.debug('Player closed');

        if(this.session !== null && this.session.state !== SessionState.ended) {
            // Update state
            this.session.state = SessionState.ended;

            // Emit event
            this.bus.emit('activity.ended', this.session.dump());
        }
    }

    _onPlaying() {
        console.debug('Video playing');

        if(this.session !== null && this.session.state !== SessionState.playing) {
            // Emit "started" event
            this._start();

            // Clear stalled state
            this.session.stalledAt = null;
            this.session.stalledPreviousState = null;
        }
    }

    _onProgress(progress, time, duration) {
        console.debug('Video progress (progress: %o, time: %o, duration: %o)', progress, time, duration);

        if(this.session === null) {
            console.warn('Unable to process "progress" event, no active sessions');
            return;
        }

        // Update activity state
        let state = this.session.state;

        if(this.session.time !== null) {
            if(time > this.session.time) {
                // Progress changed
                state = SessionState.playing;

                // Clear stalled state
                this.session.stalledAt = null;
                this.session.stalledPreviousState = null;
            } else if(time <= this.session.time) {
                // Progress hasn't changed
                if(this.session.state === SessionState.stalled && Date.now() - this.session.stalledAt > 5000) {
                    // Stalled for over 5 seconds, assume paused
                    state = SessionState.paused;
                } else {
                    // Store current state
                    this.session.stalledPreviousState = this.session.state;

                    // Switch to stalled state
                    state = SessionState.stalled;

                    // Update `stalledAt` timestamp
                    this.session.stalledAt = Date.now();
                }
            }
        }

        // Add new sample
        this.session.samples.push(time);

        // Emit event
        if(this.session.state !== state) {
            // Process state change
            this._onStateChanged(this.session.state, state);
        } else if(this.session.state === SessionState.playing && this.session.time !== null) {
            this.session.state = state;

            // Emit progress
            this._progress();
        }
    }

    _onStateChanged(previous, current) {
        if(this.session === null) {
            return;
        }

        console.debug('Video state changed: %o -> %o', previous, current);

        // Started
        if((previous === SessionState.null || previous === SessionState.paused) && current === SessionState.playing) {
            // Emit "started" event
            this._start();
            return;
        }

        // Paused
        if(previous === SessionState.playing && current === SessionState.paused) {
            // Emit "paused" event
            this._pause();
            return;
        }

        console.warn('Unknown state transition: %o -> %o', previous, current);

        // Update state
        this.session.state = current;
    }

    _shouldEmitProgress() {
        return (
            this._lastProgressEmittedAt === null ||
            Date.now() - this._lastProgressEmittedAt > PROGRESS_EVENT_INTERVAL
        );
    }

    _onPaused() {
        console.debug('Video paused');

        if(this.session !== null && this.session.state !== SessionState.paused) {
            // Emit "paused" event
            this._pause();
        }
    }

    _onEnded() {
        console.debug('Video ended');

        if(this.session !== null && this.session.state !== SessionState.ended) {
            // Update state
            this.session.state = SessionState.ended;

            // Emit event
            this.bus.emit('activity.ended', this.session.dump());
        }
    }

    // endregion

    _createSession(id) {
        // Cast `id` to an integer
        id = parseInt(id, 10);

        // Construct promise
        return new Promise((resolve, reject) => {
            console.debug('Creating session for video "' + id + '"');

            // Emit "ended" event (if there is an existing session)
            if(this.session !== null && this.session.state !== SessionState.ended) {
                this.session.state = SessionState.ended;
                this.bus.emit('activity.ended', this.session.dump());
            }

            // Reset state
            this.video = null;
            this.session = null;

            // Retrieve video metadata
            MetadataApi.get(id).then((metadata) => {
                // Construct metadata object
                this.video = Parser.parse(id, metadata);

                if(this.video === null) {
                    console.warn('Unable to parse metadata:', metadata);

                    // Reject promise
                    reject(new Error('Unable to parse metadata'));
                    return;
                }

                // Construct session
                this.session = new Session(
                    this.plugin,
                    this._nextSessionKey++,
                    this.video,
                    SessionState.LOADING
                );

                // Resolve promise
                resolve(this.session);
            });
        });
    }

    _start() {
        if(this.session === null) {
            return;
        }

        if(this.session.state === SessionState.stalled) {
            // Update session with previous state
            if(this.session.stalledPreviousState !== null) {
                this.session.state = this.session.stalledPreviousState;
            } else {
                this.session.state = SessionState.null;
            }
        }

        if(this.session.state === SessionState.playing) {
            return;
        }

        // Clear pause timeout
        if(this._pauseTimeout !== null) {
            clearTimeout(this._pauseTimeout);
            this._pauseTimeout = null;
        }

        // Update state
        this.session.state = SessionState.playing;

        // Emit event
        this.bus.emit('activity.started', this.session.dump());
    }

    _progress() {
        if(this.session === null || !this._shouldEmitProgress()) {
            return;
        }

        // Clear pause timeout
        if(this._pauseTimeout !== null) {
            clearTimeout(this._pauseTimeout);
            this._pauseTimeout = null;
        }

        // Update state
        this.session.state = SessionState.playing;

        // Emit event
        this.bus.emit('activity.progress', this.session.dump());

        // Update timestamp
        this._lastProgressEmittedAt = Date.now();
    }

    _pause() {
        if(this.session.state === SessionState.pausing || this.session.state === SessionState.paused) {
            return;
        }

        // Update state
        this.session.state = SessionState.pausing;

        // Send pause event in 5 seconds
        this._pauseTimeout = setTimeout(() => {
            if(this.session === null || this.session.state !== SessionState.pausing) {
                return;
            }

            // Update state
            this.session.state = SessionState.paused;

            // Emit event
            this.bus.emit('activity.paused', this.session.dump());
        }, 8000);
    }
}

// Register service
Registry.registerService(new NetflixActivityService());
