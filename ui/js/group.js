/*!
 * Copyright 2013 Sakai Foundation (SF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://www.osedu.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

require(['jquery', 'oae.core'], function($, oae) {

    // Get the group id from the URL. The expected URL is `/group/<tenantId>/<resourceId>`.
    // The group id will then be `g:<tenantId>:<resourceId>`
    var groupId = 'g:' + $.url().segment(2) + ':' + $.url().segment(3);

    // Variable used to cache the requested group's profile
    var groupProfile = null;
    // Variable used to cache the group's base URL
    var baseUrl = '/group/' + $.url().segment(2) + '/' + $.url().segment(3);

    /**
     * Get the group's basic profile and set up the screen. If the group
     * can't be found or is private to the current user, the appropriate
     * error page will be shown
     */
    var getGroupProfile = function() {
        oae.api.group.getGroup(groupId, function(err, profile) {
            if (err && err.code === 404) {
                oae.api.util.redirect().notfound();
            } else if (err && err.code === 401) {
                oae.api.util.redirect().accessdenied();
            }

            // Cache the group profile data
            groupProfile = profile;
            // Set the browser title
            oae.api.util.setBrowserTitle(groupProfile.displayName);
            // Render the entity information
            setUpClip();
            // Render the navigation
            setUpNavigation();
            // Set up the context event exchange
            setUpContext();
        });
    };

    /**
     * The `oae.context.get` or `oae.context.get.<widgetname>` event can be sent by widgets
     * to get hold of the current context (i.e. group profile). In the first case, a
     * `oae.context.send` event will be sent out as a broadcast to all widgets listening
     * for the context event. In the second case, a `oae.context.send.<widgetname>` event
     * will be sent out and will only be caught by that particular widget. In case the widget
     * has put in its context request before the profile was loaded, we also broadcast it out straight away.
     */
    var setUpContext = function() {
        $(document).on('oae.context.get', function(ev, widgetId) {
            if (widgetId) {
                $(document).trigger('oae.context.send.' + widgetId, groupProfile);
            } else {
                $(document).trigger('oae.context.send', groupProfile);
            }
        });
        $(document).trigger('oae.context.send', groupProfile);
    };

    /**
     * Render the group's clip, containing the profile picture, display name as well as the
     * group's admin options
     */
    var setUpClip = function() {
        oae.api.util.template().render($('#group-clip-template'), {'group': groupProfile}, $('#group-clip-container'));

        // Only show the create and upload clips to managers
        if (groupProfile.isManager) {
            $('#group-actions').show();
        }
    };

    /**
     * Set up the left hand navigation with the group space page structure
     */
    var setUpNavigation = function() {
        // Structure that will be used to construct the left hand navigation
        var lhNavigation = [
            {
                'id': 'activity',
                'title': oae.api.i18n.translate('__MSG__RECENT_ACTIVITY__'),
                'icon': 'icon-dashboard',
                'layout': [
                    {
                        'width': 'span12',
                        'widgets': [
                            {
                                'id': 'activity',
                                'settings': {
                                    'principalId': groupProfile.id,
                                    'canManage': groupProfile.isManager
                                }
                            }
                        ]
                    }
                ]
            },
            {
                'id': 'library',
                'title': oae.api.i18n.translate('__MSG__LIBRARY__'),
                'icon': 'icon-briefcase',
                'layout': [
                    {
                        'width': 'span12',
                        'widgets': [
                            {
                                'id': 'contentlibrary',
                                'settings': {
                                    'principalId': groupProfile.id,
                                    'canManage': groupProfile.isManager
                                }
                            }
                        ]
                    }
                ]
            },
            {
                'id': 'discussions',
                'title': oae.api.i18n.translate('__MSG__DISCUSSIONS__'),
                'icon': 'icon-comments',
                'layout': [
                    {
                        'width': 'span12',
                        'widgets': [
                            {
                                'id': 'discussionslibrary',
                                'settings': {
                                    'principalId': groupProfile.id,
                                    'canManage': groupProfile.isManager
                                }
                            }
                        ]
                    }
                ]
            },
            {
                'id': 'members',
                'title': oae.api.i18n.translate('__MSG__MEMBERS__'),
                'icon': 'icon-user',
                'layout': [
                    {
                        'width': 'span12',
                        'widgets': [
                            {
                                'id': 'members',
                                'settings': {
                                    'principalId': groupProfile.id,
                                    'canManage': groupProfile.isManager
                                }
                            }
                        ]
                    }
                ]
            }
        ];
        $(window).trigger('oae.trigger.lhnavigation', [lhNavigation, baseUrl]);
        $(window).on('oae.ready.lhnavigation', function() {
            $(window).trigger('oae.trigger.lhnavigation', [lhNavigation, baseUrl]);
        });
    };

    /**
     * Re-render the group's clip when a new profile picture has been uploaded. The updated
     * group profile will be passed into the event
     */
    $(document).on('oae.changepic.finished', function(ev, data) {
        groupProfile = data;
        setUpClip();
    });

    /**
     * Re-render the group's clip when the permissions have been updated.
     */
    $(document).on('done.manageaccess.oae', function(ev) {
        setUpClip();
    });

    /**
     * Creates the widgetData object to send to the manageaccess widget that contains all
     * variable values needed by the widget.
     *
     * @return  {Object}    The widgetData to be passed into the manageaccess widget
     * @see  manageaccess#initManageAccess
     */
    var getManageAccessData = function() {
        return {
            'contextProfile': groupProfile,
            'messages': {
                'accessnotupdated': oae.api.i18n.translate('__MSG__GROUP_ACCESS_NOT_UPDATED__'),
                'accesscouldnotbeupdated': oae.api.i18n.translate('__MSG__GROUP_ACCESS_COULD_NOT_BE_UPDATED__'),
                'accesssuccessfullyupdated': oae.api.i18n.translate('__MSG__GROUP_ACCESS_SUCCESSFULLY_UPDATED__'),
                'accessupdated': oae.api.i18n.translate('__MSG__GROUP_ACCESS_UPDATED__'),
                'members': oae.api.i18n.translate('__MSG__GROUP_MEMBERS__'),
                'private': oae.api.i18n.translate('__MSG__PARTICIPANTS_ONLY__'),
                'loggedin': oae.api.util.security().encodeForHTML(groupProfile.tenant.displayName),
                'public': oae.api.i18n.translate('__MSG__PUBLIC__'),
                'privatedescription': oae.api.i18n.translate('__MSG__GROUP_PRIVATE_DESCRIPTION__'),
                'loggedindescription': oae.api.i18n.translate('__MSG__GROUP_LOGGEDIN_DESCRIPTION__').replace('${tenant}', oae.api.util.security().encodeForHTML(groupProfile.tenant.displayName)),
                'publicdescription': oae.api.i18n.translate('__MSG__GROUP_PUBLIC_DESCRIPTION__')
            },
            'roles': {
                'member': oae.api.i18n.translate('__MSG__MEMBER__'),
                'manager': oae.api.i18n.translate('__MSG__MANAGER__')
            },
            'api': {
                'getMembersURL': '/api/group/' + groupProfile.id + '/members',
                'setMembers': oae.api.group.setGroupMembers,
                'setVisibility': oae.api.group.updateGroup
            }
        };
    };

    /*!
     * Triggers the manageaccess widget and passes in context data
     */
    $(document).on('click', '.group-trigger-manageaccess', function() {
        $(document).trigger('oae.trigger.manageaccess', getManageAccessData());
    });

    /*!
     * Triggers the manageaccess widget in `add members` view and passes in context data
     */
    $(document).on('click', '.group-trigger-manageaccess-add', function() {
        $(document).trigger('oae.trigger.manageaccess-add', getManageAccessData());
    });

    getGroupProfile();

});
