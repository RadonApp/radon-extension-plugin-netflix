import {Resources} from 'eon.extension.browser';

import ActivityService from 'eon.extension.framework/services/source/activity';
import Registry from 'eon.extension.framework/core/registry';
import MessagingBus, {ContextTypes} from 'eon.extension.framework/messaging/bus';
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
            let url = Resources.getUrl('source.netflix.shim/source.netflix.shim.js');

            // Create script element
            let script = document.createElement('script');

            script.src = url;
            script.onload = function() {
                this.remove();
            };

            // Bind shim api to page
            ShimApi.bind(document);

            // Wait for "ready" event
            ShimApi.once('ready', () => {
                resolve();
            });

            // TODO implement timeout?

            // Insert element into page
            (document.head || document.documentElement)
                .appendChild(script);
        });
    }

    // region Event handlers

    _onOpen(videoId) {
        this._createSession(videoId).then((session) => {
            // Emit "created" event
            this.bus.emit('activity.created', session.dump());
        }, (error) => {
            // Unable to create session
            console.warn('Unable to create session:', error);
        });
    }

    _onClose() {
        if(this.session !== null && this.session.state !== SessionState.ended) {
            // Update state
            this.session.state = SessionState.ended;

            // Emit event
            this.bus.emit('activity.ended', this.session.dump());
        }
    }

    _onPlaying() {
        if(this.session !== null && this.session.state !== SessionState.playing) {
            // Update state
            this.session.state = SessionState.playing;

            // Emit event
            this.bus.emit('activity.started', this.session.dump());
        }
    }

    _onProgress(progress, time, duration) {
        if(this.session === null) {
            console.warn('Unable to process "progress" event, no active sessions');
            return;
        }

        // Update activity state
        let state = this.session.state;

        if(this.session.time !== null) {
            if(time > this.session.time) {
                state = SessionState.playing;
            } else if(time <= this.session.time) {
                state = SessionState.paused;
            }
        }

        // Add new sample
        this.session.samples.push(time);

        // Emit event
        if(this.session.state !== state) {
            let previous = this.session.state;

            this.session.state = state;

            // Emit state change
            this._onStateChanged(previous, state);
        } else if(this.session.state === SessionState.playing && this.session.time !== null) {
            this.session.state = state;

            // Emit progress
            if(this._shouldEmitProgress()) {
                // Emit event
                this.bus.emit('activity.progress', this.session.dump());

                // Update timestamp
                this._lastProgressEmittedAt = Date.now();
            }
        }
    }

    _onStateChanged(previous, current) {
        if(this.session === null) {
            return;
        }

        console.debug('_onStateChanged(%o, %o)', previous, current);

        // Determine event from state change
        let event = null;

        if((previous === SessionState.null || previous === SessionState.paused) && current === SessionState.playing) {
            event = 'activity.started';
        } else if(previous === SessionState.playing && current === SessionState.paused) {
            event = 'activity.paused';
        } else {
            return;
        }

        // Emit event
        this.bus.emit(event, this.session.dump());
    }

    _shouldEmitProgress() {
        return (
            this._lastProgressEmittedAt === null ||
            Date.now() - this._lastProgressEmittedAt > PROGRESS_EVENT_INTERVAL
        );
    }

    _onPaused() {
        console.debug('_onPaused()');

        if(this.session !== null && this.session.state !== SessionState.paused) {
            // Update state
            this.session.state = SessionState.paused;

            // Emit event
            this.bus.emit('activity.paused', this.session.dump());
        }
    }

    _onEnded() {
        console.debug('_onEnded()');

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
}

// Register service
Registry.registerService(new NetflixActivityService());
