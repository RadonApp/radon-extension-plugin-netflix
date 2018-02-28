import EventEmitter from 'eventemitter3';

import Log from '../../../core/logger';


export default class ApplicationObserver extends EventEmitter {
    constructor() {
        super();

        this.currentPath = null;

        // Construct observer
        this._observer = new MutationObserver(
            (mutations) => this._onMutations(mutations)
        );
    }

    bind(appMountPoint) {
        // Observe mount point for changes
        this._observe(appMountPoint);
    }

    update() {
        if(location.pathname === this.currentPath) {
            return;
        }

        // Emit "navigate.from" event
        if(this.currentPath !== null) {
            Log.debug('Navigating away from path: %o', this.currentPath);
            this.emit('navigate.from', this.currentPath);
        }

        // Update current path
        this.currentPath = location.pathname;

        // Emit "navigate.to" event
        Log.debug('Navigating to path: %o', this.currentPath);
        this.emit('navigate.to', this.currentPath);
    }

    _observe(node) {
        this._observer.observe(node, {childList: true});

        if(!this._isContainer(node)) {
            return;
        }

        // Observe children
        for(let i = 0; i < node.childNodes.length; ++i) {
            let child = node.childNodes[i];

            if(child.tagName !== 'DIV') {
                continue;
            }

            if(child.childNodes.length === 1 && child.childNodes[0].classList.length === 0) {
                child = child.childNodes[0];
            }

            this._observe(child);
        }
    }

    // region Event handlers

    _onMutations(mutations) {
        for(let i = 0; i < mutations.length; ++i) {
            this._onMutation(mutations[i]);
        }
    }

    _onMutation(mutation) {
        if(this._isContainer(mutation.target)) {
            for(let i = 0; i < mutation.addedNodes.length; ++i) {
                let node = mutation.addedNodes[i];

                if(node.tagName !== 'DIV') {
                    continue;
                }

                this._observe(node);
            }
        }

        if(mutation.addedNodes.length > 0) {
            this.update();
        }
    }

    // endregion

    // region Helpers

    _isContainer(node) {
        return node.id === 'appMountPoint' ||
            node.parentNode.id === 'appMountPoint';
    }

    // endregion
}
