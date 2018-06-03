/* eslint-disable no-multi-spaces, key-spacing */
import Filter from 'lodash-es/filter';
import IsEqual from 'lodash-es/isEqual';
import IsNil from 'lodash-es/isNil';
import Map from 'lodash-es/map';

import ApplicationObserver from './Application';
import Log from '../Core/Logger';
import Observer from './Base';
import VideoObserver from './Video';


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
        this._currentSubtitle = null;
        this._currentVideo = null;

        // Create video observer
        this._videoObserver = new VideoObserver();

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
        this.title = this.observe(this.info, 'h4:not(.ellipsize-text)', { text: true })
            .on('mutation', this.onTitleChanged.bind(this));

        // Observe subtitle
        this.subtitle = this.observe(this.info, 'div span', { text: true })
            .on('mutation', this.onSubtitleChanged.bind(this));
    }

    observeVideo() {
        if(IsNil(this._currentTitle)) {
            Log.debug('Deferring video observations, no title available');
            return;
        }

        if(IsNil(this._currentVideo)) {
            Log.debug('Deferring video observations, no video available');
            return;
        }

        // Start observing video
        this._videoObserver.start(this._currentVideo);
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

        // Update state
        this._currentVideo = node;

        // Start video observations
        this.observeVideo();

        // Emit "opened" event
        this.emit('opened');
    }

    onVideoRemoved({ node }) {
        Log.trace('Video removed: %o', node);

        // Reset state
        this._currentTitle = null;
        this._currentSubtitle = null;
        this._currentVideo = null;

        // Stop video observations
        this._videoObserver.stop(node);

        // Emit "closed" event
        this.emit('closed');
    }

    onTitleChanged() {
        let node = this.title.first();
        let current = (node && node.innerText) || null;

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

        // Start video observations
        this.observeVideo();
    }

    onSubtitleChanged() {
        let current = Filter(Map(this.subtitle.all(), (node) => node.innerText || null, IsNil));

        if(current.length === 0) {
            current = null;
        }

        // Ensure subtitle(s) have changed
        if(IsEqual(this._currentSubtitle, current)) {
            return;
        }

        // Retrieve previous subtitle(s)
        let previous = this._currentSubtitle;

        // Update current subtitle(s)
        this._currentSubtitle = current;

        // Update application navigation
        ApplicationObserver.onNavigated();

        // Emit event
        this.emit('subtitle', { previous, current });

        // Log subtitle change
        Log.trace('Subtitle changed to %o', current);

        // Start video observations
        this.observeVideo();
    }

    // endregion
}

export default new PlayerObserver();
