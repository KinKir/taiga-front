/*
 * Copyright (C) 2014-2017 Andrey Antukh <niwi@niwi.nz>
 * Copyright (C) 2014-2017 Jesús Espino Garcia <jespinog@gmail.com>
 * Copyright (C) 2014-2017 David Barragán Merino <bameda@dbarragan.com>
 * Copyright (C) 2014-2017 Alejandro Alonso <alejandro.alonso@kaleidos.net>
 * Copyright (C) 2014-2017 Juan Francisco Alcántara <juanfran.alcantara@kaleidos.net>
 * Copyright (C) 2014-2017 Xavi Julian <xavier.julian@kaleidos.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * File: modules/team/main.coffee
 */

import {PageMixin} from "../controllerMixins";

import * as angular from "angular";
import * as _ from "lodash";

//############################################################################
//# Team Controller
//############################################################################

export class TeamController extends PageMixin {
    scope: angular.IScope;
    rootscope: angular.IScope;
    repo: any;
    rs: any;
    params: any;
    q: any;
    location: any;
    navUrls: any;
    appMetaService: any;
    auth: any;
    translate: any;
    projectService: any;
    errorHandlingService: any;

    static initClass() {
        this.$inject = [
            "$scope",
            "$rootScope",
            "$tgRepo",
            "$tgResources",
            "$routeParams",
            "$q",
            "$location",
            "$tgNavUrls",
            "tgAppMetaService",
            "$tgAuth",
            "$translate",
            "tgProjectService",
            "tgErrorHandlingService",
        ];
    }

    constructor(scope, rootscope, repo, rs, params, q, location, navUrls, appMetaService, auth,
                translate, projectService, errorHandlingService) {
        super();
        this.scope = scope;
        this.rootscope = rootscope;
        this.repo = repo;
        this.rs = rs;
        this.params = params;
        this.q = q;
        this.location = location;
        this.navUrls = navUrls;
        this.appMetaService = appMetaService;
        this.auth = auth;
        this.translate = translate;
        this.projectService = projectService;
        this.errorHandlingService = errorHandlingService;
        this.scope.sectionName = "TEAM.SECTION_NAME";

        const promise = this.loadInitialData();

        // On Success
        promise.then(() => {
            const title = this.translate.instant("TEAM.PAGE_TITLE", {projectName: this.scope.project.name});
            const description = this.translate.instant("TEAM.PAGE_DESCRIPTION", {
                projectName: this.scope.project.name,
                projectDescription: this.scope.project.description,
            });
            return this.appMetaService.setAll(title, description);
        });

        // On Error
        promise.then(null, this.onInitialDataError.bind(this));
    }

    setRole(role) {
        if (role) {
            return this.scope.filtersRole = role;
        } else {
            return this.scope.filtersRole = null;
        }
    }

    loadMembers() {
        const user = this.auth.getUser();

        // Calculate totals
        this.scope.totals = {};
        for (const member of this.scope.activeUsers) {
            this.scope.totals[member.id] = 0;
        }

        // Get current user
        this.scope.currentUser = _.find(this.scope.activeUsers, {id: (user != null ? user.id : undefined)});

        // Get member list without current user
        return this.scope.memberships = _.reject(this.scope.activeUsers, {id: (user != null ? user.id : undefined)});
    }

    loadProject() {
        const project = this.projectService.project.toJS();

        this.scope.projectId = project.id;
        this.scope.project = project;
        this.scope.$emit("project:loaded", project);

        this.scope.issuesEnabled = project.is_issues_activated;
        this.scope.tasksEnabled = project.is_kanban_activated || project.is_backlog_activated;
        this.scope.wikiEnabled = project.is_wiki_activated;
        this.scope.owner = project.owner.id;

        return project;
    }

    loadMemberStats() {
        return this.rs.projects.memberStats(this.scope.projectId).then((stats) => {
          const totals = {};
          _.forEach(this.scope.totals, (total, userId) => {
              const vals = _.map(stats, (memberStats, statsKey) => memberStats[userId]);
              total = _.reduce(vals, (sum, el) => sum + el);
              return this.scope.totals[userId] = total;
          });

          this.scope.stats = this._processStats(stats);
          return this.scope.stats.totals = this.scope.totals;
        });
    }

    _processStat(stat) {
        const max: number = _.max(_.toArray(stat)) as number;
        const min: number = _.min(_.toArray(stat)) as number;

        const singleStat = Object();
        for (const key of Object.keys(stat || {})) {
            const value: number = stat[key];
            if (value === min) {
                singleStat[key] = 0.1;
            } else if (value === max) {
                singleStat[key] = 1;
            } else {
                singleStat[key] = (value * 0.5) / max;
            }
        }

        return singleStat;
    }

    _processStats(stats) {
        for (const key in stats) {
            const value = stats[key];
            stats[key] = this._processStat(value);
        }
        return stats;
    }

    loadInitialData() {
        const project = this.loadProject();

        this.fillUsersAndRoles(project.members, project.roles);
        this.loadMembers();

        const userRoles = _.map(this.scope.users, (user: any) => user.role);

        this.scope.roles = _.filter(this.scope.roles, (role: any) => userRoles.indexOf(role.id) !== -1);

        return this.loadMemberStats();
    }
}
TeamController.initClass();

//############################################################################
//# Team Filters Directive
//############################################################################

export let TeamFiltersDirective = () =>
    ({
        templateUrl: "team/team-filter.html",
    })
;

//############################################################################
//# Team Member Stats Directive
//############################################################################

export let TeamMemberStatsDirective = () =>
    ({
        templateUrl: "team/team-member-stats.html",
        scope: {
            stats: "=",
            userId: "=user",
            issuesEnabled: "=issuesenabled",
            tasksEnabled: "=tasksenabled",
            wikiEnabled: "=wikienabled",
        },
    })
;

//############################################################################
//# Team Current User Directive
//############################################################################

export let TeamMemberCurrentUserDirective = () =>
    ({
        templateUrl: "team/team-member-current-user.html",
        scope: {
            project: "=project",
            currentUser: "=currentuser",
            stats: "=",
            issuesEnabled: "=issuesenabled",
            tasksEnabled: "=tasksenabled",
            wikiEnabled: "=wikienabled",
            owner: "=owner",
        },
    })
;

//############################################################################
//# Team Members Directive
//############################################################################

export let TeamMembersDirective = function() {
    const template = "team/team-members.html";

    return {
        templateUrl: template,
        scope: {
            memberships: "=",
            filtersQ: "=filtersq",
            filtersRole: "=filtersrole",
            stats: "=",
            issuesEnabled: "=issuesenabled",
            tasksEnabled: "=tasksenabled",
            wikiEnabled: "=wikienabled",
            owner: "=owner",
        },
    };
};

//############################################################################
//# Leave project Directive
//############################################################################

export let LeaveProjectDirective = function($repo, $confirm, $location, $rs, $navurls, $translate, lightboxFactory, currentUserService) {
    const link = function($scope, $el, $attrs) {
        const leaveConfirm = function() {
            const leave_project_text = $translate.instant("TEAM.ACTION_LEAVE_PROJECT");
            const confirm_leave_project_text = $translate.instant("TEAM.CONFIRM_LEAVE_PROJECT");

            return $confirm.ask(leave_project_text, confirm_leave_project_text).then((response) => {
                const promise = $rs.projects.leave($scope.project.id);

                promise.then(() => {
                    return currentUserService.loadProjects().then(function() {
                        response.finish();
                        $confirm.notify("success");
                        return $location.path($navurls.resolve("home"));
                    });
                });

                return promise.then(null, function(response) {
                    response.finish();
                    return $confirm.notify("error", response.data._error_message);
                });
            });
        };

        return $scope.leave = function() {
            if ($scope.project.owner.id === $scope.user.id) {
                return lightboxFactory.create("tg-lightbox-leave-project-warning", {
                    class: "lightbox lightbox-leave-project-warning",
                }, {
                    isCurrentUser: true,
                    project: $scope.project,
                });
            } else {
                return leaveConfirm();
            }
        };
    };

    return {
        scope: {
            user: "=",
            project: "=",
        },
        templateUrl: "team/leave-project.html",
        link,
    };
};

//############################################################################
//# Team Filters
//############################################################################

export let membersFilter = () =>
    (members, filtersQ, filtersRole) =>
        _.filter(members, (m: any) => (!filtersRole || (m.role === filtersRole.id)) &&
                                        (!filtersQ || (m.full_name.search(new RegExp(filtersQ, "i")) >= 0)),
         )
;
