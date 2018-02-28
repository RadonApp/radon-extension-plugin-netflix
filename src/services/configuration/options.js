import {
    Group,
    Page,
    EnableOption,
    SelectOption
} from 'neon-extension-framework/services/configuration/models';

import Plugin from '../../core/plugin';


export default [
    new Page(Plugin, null, Plugin.title, [
        new EnableOption(Plugin, 'enabled', 'Enabled', {
            default: false,

            type: 'plugin',
            permissions: true,
            contentScripts: true
        }),

        // new Group(Plugin, 'activity', 'Activity', [
        //     new EnableOption(Plugin, 'enabled', 'Enabled', {
        //         default: true,
        //         requires: ['enabled'],
        //
        //         type: 'service'
        //     }),
        //
        //     new CheckboxOption(Plugin, 'movies', 'Movies', {
        //         default: true,
        //         requires: ['activity:enabled']
        //     }),
        //
        //     new CheckboxOption(Plugin, 'episodes', 'Episodes', {
        //         default: true,
        //         requires: ['activity:enabled']
        //     })
        // ]),
        //
        // new Group(Plugin, 'sync', 'Sync', [
        //     new EnableOption(Plugin, 'enabled', 'Enabled', {
        //         default: true,
        //         requires: ['enabled'],
        //
        //         type: 'service'
        //     }),
        //
        //     new CheckboxOption(Plugin, 'history', 'Watched history', {
        //         default: true,
        //         requires: ['sync:enabled']
        //     }),
        //
        //     new CheckboxOption(Plugin, 'ratings', 'Ratings', {
        //         default: true,
        //         requires: ['sync:enabled']
        //     })
        // ]),

        new Group(Plugin, 'debugging', 'Debugging', [
            new SelectOption(Plugin, 'log_level', 'Log Level', [
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
