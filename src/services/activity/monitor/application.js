import EventEmitter from 'eventemitter3';


export default class ApplicationMonitor extends EventEmitter {
    constructor(main) {
        super();

        this.main = main;

        this.currentPath = null;

        // Construct observer
        this.observer = new MutationObserver(
            (mutations) => this._onMutations(mutations)
        );

        // Bind to main events
        this.main.on('bound', (appMountPoint) => this._onBound(appMountPoint));
    }

    update() {
        if(location.pathname === this.currentPath) {
            return;
        }

        // Emit "navigate.from" event
        if(this.currentPath !== null) {
            this.emit('navigate.from', this.currentPath);
        }

        // Update current path
        this.currentPath = location.pathname;

        // Emit "navigate.to" event
        this.emit('navigate.to', this.currentPath);
    }

    _observe(node) {
        this.observer.observe(node, {childList: true});

        if(!this._isContainer(node)) {
            return;
        }

        // Observe children
        for (var i = 0; i < node.childNodes.length; ++i) {
            var child = node.childNodes[i];

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

    _onBound(appMountPoint) {
        this._observe(appMountPoint);
    }

    _onMutations(mutations) {
        for(var i = 0; i < mutations.length; ++i) {
            this._onMutation(mutations[i]);
        }
    }

    _onMutation(mutation) {
        if(this._isContainer(mutation.target)) {
            for(var i = 0; i < mutation.addedNodes.length; ++i) {
                var node = mutation.addedNodes[i];

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
