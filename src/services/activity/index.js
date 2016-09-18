import {Resources} from 'eon.extension.browser';

import ActivityService from 'eon.extension.framework/base/services/source/activity';
import Bus from 'eon.extension.framework/core/bus';
import Registry from 'eon.extension.framework/core/registry';
import Session, {SessionState} from 'eon.extension.framework/models/activity/session';

import Parser from './core/parser';
import MetadataApi from '../../api/metadata';
import Plugin from '../../core/plugin';
import ShimApi from '../../api/shim';
import Monitor from './monitor';


export class NetflixActivityService extends ActivityService {
    constructor() {
        super(Plugin);

        this.session = null;
        this.video = null;

        this._nextSessionKey = 0;

        // Configure event bus
        Bus.configure('service/activity');

        // Initialize activity monitor
        this.monitor = new Monitor(this);
        this.monitor.player.on('open', (videoId) => this._onOpen(videoId));
        this.monitor.player.on('playing', () => this._onPlaying());
        this.monitor.player.on('paused', () => this._onPaused());
        this.monitor.player.on('ended', () => this._onEnded());

        this.monitor.player.on('progress', (progress, time, duration) =>
            this._onProgress(progress, time, duration)
        );
    }

    initialize() {
        // Inject netflix shim
        this.inject().then(() => {
            // Bind activity monitor to document
            this.monitor.bind(document);
        }, (error) => {
            console.error('Unable to inject shim', error);
        });
    }

    inject() {
        var self = this;

        return new Promise((resolve, reject) => {
            var url = Resources.getUrl('source.netflix.shim/source.netflix.shim.js');

            // Create script element
            var script = document.createElement('script');
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
        console.log('_onOpen()', videoId);

        this._createSession(videoId);
    }

    _onPlaying() {
        console.log('_onPlaying()');
    }

    _onProgress(progress, time, duration) {
        if(this.session === null) {
            console.log('Unable to process "progress" event, no active sessions');
            return;
        }

        // Update activity state
        if(this.session.time !== null) {
            if (time > this.session.time) {
                this.session.state = SessionState.playing;
            } else if (time <= this.session.time) {
                this.session.state = SessionState.paused;
            }
        }

        // Add new sample
        this.session.samples.push(time);

        // Emit event
        if(this.session.time !== null) {
            this.emit('progress', this.session.dump());
        }
    }

    _onPaused() {
        console.log('_onPaused()');
    }

    _onEnded() {
        console.log('_onEnded()');
    }

    _onShimEvent(e) {
        console.log('_onShimEvent', e);
    }

    // endregion

    _createSession(id) {
        console.log("Creating session for video \"" + id + "\"");

        // Cast `id` to an integer
        id = parseInt(id);

        // Reset state
        this.video = null;
        this.session = null;

        // Retrieve video metadata
        MetadataApi.get(id).then((metadata) => {
            console.log('metadata:', metadata);

            // Construct metadata object
            this.video = Parser.parse(id, metadata);

            if(this.video === null) {
                console.warn('Unable to parse metadata:', metadata);
                return;
            }

            console.log('video:', this.video);

            // Construct session
            this.session = new Session(
                this.plugin,
                this._nextSessionKey++,
                this.video,
                SessionState.LOADING
            );

            console.log('session:', this.session);
        });
    }
}

// Register service
Registry.registerService(new NetflixActivityService());
