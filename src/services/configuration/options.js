import {
    Group,
    Page,
    CheckboxOption,
    EnableOption,
    SelectOption
} from 'neon-extension-framework/services/configuration/models';

import Plugin from 'neon-extension-source-netflix/core/plugin';


export default [
    new Page(Plugin, null, Plugin.title, [
        new EnableOption(Plugin, 'enabled', 'Enabled', {
            default: false,

            type: 'plugin',
            permissions: true,
            contentScripts: true
        }),

        new Group(Plugin, 'activity', 'Activity', [
            new EnableOption(Plugin, 'activity:enabled', 'Enabled', {
                default: true,
                requires: ['enabled'],

                type: 'service'
            }),

            new CheckboxOption(Plugin, 'activity.movies', 'Movies', {
                default: true,
                requires: ['activity.enabled']
            }),

            new CheckboxOption(Plugin, 'activity.episodes', 'Episodes', {
                default: true,
                requires: ['activity.enabled']
            })
        ]),

        new Group(Plugin, 'sync', 'Sync', [
            new EnableOption(Plugin, 'sync:enabled', 'Enabled', {
                default: true,
                requires: ['enabled'],

                type: 'service'
            }),

            new CheckboxOption(Plugin, 'sync.history', 'Watched history', {
                default: true,
                requires: ['sync.enabled']
            }),

            new CheckboxOption(Plugin, 'sync.ratings', 'Ratings', {
                default: true,
                requires: ['sync.enabled']
            })
        ]),

        new Group(Plugin, 'debugging', 'Debugging', [
            new SelectOption(Plugin, 'debugging.log_level', 'Log Level', [
                {key: 'error', label: 'Error'},
                {key: 'warning', label: 'Warning'},
                {key: 'notice', label: 'Notice'},
                {key: 'info', label: 'Info'},
                {key: 'debug', label: 'Debug'},
                {key: 'trace', label: 'Trace'}
            ], {
                default: 'warning'
            })
        ])
    ])
];
