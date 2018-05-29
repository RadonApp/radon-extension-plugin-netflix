/* eslint-disable no-multi-spaces, key-spacing */
import EventEmitter from 'eventemitter3';
import IsNil from 'lodash-es/isNil';
import IsString from 'lodash-es/isString';

import ApplicationObserver from 'neon-extension-source-netflix/Application/Observer';
import Log from 'neon-extension-source-netflix/Core/Logger';
import Plugin from 'neon-extension-source-netflix/Core/Plugin';
import {Movie, Show, Season, Episode} from 'neon-extension-framework/Models/Metadata/Video';

import PlayerObserver from './Observer';


export default class PlayerMonitor extends EventEmitter {
    constructor() {
        super();

        // Private attributes
        this._currentId = null;
        this._currentTitle = null;
        this._currentSubtitle = null;

        this._currentItem = null;
        this._currentPath = null;

        // Bind to application events
        ApplicationObserver.on('navigate',  this.onNavigated.bind(this));

        // Bind to player events
        PlayerObserver.on('opened',         this.onOpened.bind(this));
        PlayerObserver.on('closed',         this.onClosed.bind(this));
        PlayerObserver.on('loaded',         this.onLoaded.bind(this));
        PlayerObserver.on('started',        this.onStarted.bind(this));

        PlayerObserver.on('title',          this.onTitleChanged.bind(this));
        PlayerObserver.on('subtitle',       this.onSubtitleChanged.bind(this));

        PlayerObserver.on('paused',         this.emit.bind(this, 'paused'));
        PlayerObserver.on('stopped',        this.emit.bind(this, 'stopped'));

        PlayerObserver.on('progress',       this.emit.bind(this, 'progress'));
        PlayerObserver.on('seeked',         this.emit.bind(this, 'seeked'));
    }

    start() {
        // Start observing application
        ApplicationObserver.start();

        // Start observing player
        PlayerObserver.start();
    }

    reset() {
        Log.trace('PlayerMonitor.reset');

        // Reset state
        this._currentId = null;
        this._currentTitle = null;
        this._currentSubtitle = null;

        this._currentItem = null;
    }

    getDuration() {
        return PlayerObserver.getDuration();
    }

    // region Event Handlers

    onNavigated({ previous, current }) {
        Log.trace('PlayerMonitor.onNavigated: %o -> %o', previous, current);

        if(!IsNil(previous)) {
            // Close session
            this.onClosed();

            // Reset state
            this.reset();
        }

        // Update video identifier
        let match = /^\/watch\/(\d+)$/g.exec(current);

        if(!IsNil(match)) {
            this._currentId = match[1];
        } else {
            this._currentId = null;
        }
    }

    onOpened() {
        Log.trace('PlayerMonitor.onOpened');

        if(IsNil(this._currentItem)) {
            return;
        }

        // Emit "opened" event
        this.emit('opened', this._currentItem);
    }

    onLoaded() {
        Log.trace('PlayerMonitor.onLoaded');

        // Update item
        if(this._updateItem()) {
            this.emit('created', this._currentItem);
        } else if(!IsNil(this._currentItem)) {
            this.emit('loaded', this._currentItem);
        }
    }

    onStarted() {
        Log.trace('PlayerMonitor.onStarted');

        // Update item
        if(this._updateItem()) {
            this.emit('created', this._currentItem);
        }

        // Ensure item exists
        if(IsNil(this._currentItem)) {
            return;
        }

        // Emit "started" event
        this.emit('started');
    }

    onClosed() {
        Log.trace('PlayerMonitor.onClosed');

        if(IsNil(this._currentItem)) {
            return;
        }

        // Emit "closed" event
        this.emit('closed', this._currentItem);
    }

    onTitleChanged({ previous, current }) {
        Log.trace('PlayerMonitor.onTitleChanged: %o -> %o', previous, current);

        this._currentTitle = current;
    }

    onSubtitleChanged({ previous, current }) {
        Log.trace('PlayerMonitor.onSubtitleChanged: %o -> %o', previous, current);

        this._currentSubtitle = current;
    }

    // endregion

    // region Private Methods

    _updateItem() {
        let item = null;

        // Try construct track
        try {
            item = this._createItem();
        } catch(e) {
            Log.error('Unable to create track: %s', e.message || e);
        }

        // Ensure track exists
        if(IsNil(item)) {
            Log.warn('Unable to parse item', {
                id: this._currentId,
                title: this._currentTitle,
                subtitle: this._currentSubtitle
            });

            // Clear current item
            this._currentItem = null;

            return false;
        }

        // Ensure track has changed
        if(!IsNil(this._currentItem) && this._currentItem.matches(item)) {
            return false;
        }

        // Update current item
        this._currentItem = item;

        return true;
    }

    _createItem() {
        let id = this._currentId;
        let title = this._currentTitle;
        let subtitle = this._currentSubtitle;

        if(!this._stringExists(id) || !this._stringExists(title)) {
            return null;
        }

        // Movie
        if(IsNil(subtitle)) {
            return this._createMovie(title, id);
        }

        // Episode
        return this._createEpisode(title, id, ...subtitle);
    }

    _createMovie(title, id) {
        return Movie.create(Plugin.id, {
            keys: this._createKeys({
                id
            }),

            // Metadata
            title
        });
    }

    _createShow(title) {
        return Show.create(Plugin.id, {
            title
        });
    }

    _createSeason(showTitle, number) {
        return Season.create(Plugin.id, {
            // Metadata
            number,

            // Children
            show: this._createShow(showTitle)
        });
    }

    _createEpisode(showTitle, id, identifier, title) {
        let { season, number } = this._parseEpisodeIdentifier(identifier);

        if(IsNil(season) || IsNil(number)) {
            return null;
        }

        return Episode.create(Plugin.id, {
            keys: this._createKeys({
                id
            }),

            // Metadata
            title,
            number,

            // Children
            season: this._createSeason(showTitle, season)
        });
    }

    _createKeys(keys) {
        // TODO Add `keys` with country suffixes
        return keys;
    }

    _parseEpisodeIdentifier(number) {
        let match = /^\w(\d+):\w(\d+)$/g.exec(number);

        if(IsNil(match)) {
            return {
                season: null,
                number: null
            };
        }

        // Try parse numbers
        try {
            return {
                season: parseInt(match[1], 10),
                number: parseInt(match[2], 10)
            };
        } catch(e) {
            Log.warn('Unable to parse episode number: %o', number);

            return {
                season: null,
                number: null
            };
        }
    }

    _stringExists(value) {
        if(IsNil(value)) {
            return false;
        }

        if(!IsString(value)) {
            return false;
        }

        return value.length > 0;
    }

    // endregion
}
