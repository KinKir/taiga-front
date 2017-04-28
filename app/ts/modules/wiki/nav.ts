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
 * File: modules/wiki/detail.coffee
 */

import {autoScroll} from "../../libs/dom-autoscroller";
import {bindOnce, groupBy} from "../../libs/utils";

import * as angular from "angular";
import * as dragula from "dragula";

//############################################################################
//# Wiki Main Directive
//############################################################################

export let WikiNavDirective = function($tgrepo, $log, $location, $confirm, $analytics, $loading, $template,
                                       $compile, $translate) {
    const template = $template.get("wiki/wiki-nav.html", true);

    const linkWikiLinks = function($scope, $el, $attrs) {
        const $ctrl = $el.controller();

        if (($attrs.ngModel == null)) {
            return $log.error("WikiNavDirective: no ng-model attr is defined");
        }

        let addWikiLinkPermission = $scope.project.my_permissions.indexOf("add_wiki_link") > -1;
        let drake = null;

        const render = function(wikiLinks) {
            addWikiLinkPermission = $scope.project.my_permissions.indexOf("add_wiki_link") > -1;
            const deleteWikiLinkPermission = $scope.project.my_permissions.indexOf("delete_wiki_link") > -1;

            let html = template({
                wikiLinks,
                projectSlug: $scope.projectSlug,
                addWikiLinkPermission,
                deleteWikiLinkPermission,
            });

            html = $compile(html)($scope);

            $el.off();
            if (addWikiLinkPermission && drake) {
                drake.destroy();
            }

            $el.html(html);

            if (addWikiLinkPermission) {
                let itemEl = null;
                const tdom = $el.find(".sortable");

                drake = dragula([tdom[0]], {
                    direction: "vertical",
                    copySortSource: false,
                    copy: false,
                    mirrorContainer: tdom[0],
                    moves(item) { return $(item).is("li"); },
                } as dragula.DragulaOptions);

                drake.on("dragend", function(item) {
                    itemEl = $(item);
                    item = itemEl.scope().link;
                    const itemIndex = itemEl.index();
                    return $scope.$emit("wiki:links:move", item, itemIndex);
                });

                const scroll = autoScroll(window, {
                    margin: 20,
                    pixels: 30,
                    scrollWhenOutside: true,
                    autoScroll() {
                        return this.down && drake.dragging;
                    },
                });
            }

            $el.on("click", ".add-button", function(event) {
                event.preventDefault();
                $el.find(".new").removeClass("hidden");
                $el.find(".new input").focus();
                return $el.find(".add-button").hide();
            });

            $el.on("click", ".js-delete-link", function(event) {
                event.preventDefault();
                event.stopPropagation();
                const target = angular.element(event.currentTarget);
                const linkId = target.parents(".wiki-link").data("id");

                const title = $translate.instant("WIKI.DELETE_LINK_TITLE");
                const message = $scope.wikiLinks[linkId].title;

                return $confirm.askOnDelete(title, message).then((askResponse) => {
                    let promise = $tgrepo.remove($scope.wikiLinks[linkId]);
                    promise.then(function() {
                        promise = $ctrl.loadWikiLinks();
                        promise.then(function() {
                            askResponse.finish();
                            return render($scope.wikiLinks);
                        });
                        return promise.then(null, () => askResponse.finish());
                    });
                    return promise.then(null, function() {
                        askResponse.finish(false);
                        return $confirm.notify("error");
                    });
                });
            });

            return $el.on("keyup", ".new input", function(event) {
                let target;
                event.preventDefault();
                if (event.keyCode === 13) {
                    target = angular.element(event.currentTarget);
                    const newLink = target.val();

                    const currentLoading = $loading()
                        .target($el.find(".new"))
                        .start();

                    const promise = $tgrepo.create("wiki-links", {project: $scope.projectId, title: newLink});
                    promise.then(function() {
                        $analytics.trackEvent("wikilink", "create", "create wiki link", 1);
                        const loadPromise = $ctrl.loadWikiLinks();
                        loadPromise.then(function() {
                            currentLoading.finish();
                            $el.find(".new").addClass("hidden");
                            $el.find(".new input").val("");
                            $el.find(".add-button").show();
                            return render($scope.wikiLinks);
                        });
                        return loadPromise.then(null, function() {
                            currentLoading.finish();
                            $el.find(".new").addClass("hidden");
                            $el.find(".new input").val("");
                            $el.find(".add-button").show();
                            return $confirm.notify("error", "Error loading wiki links");
                        });
                    });

                    return promise.then(null, function(error) {
                        currentLoading.finish();
                        $el.find(".new input").val(newLink);
                        $el.find(".new input").focus().select();
                        if (__guard__(error != null ? error.__all__ : undefined, (x) => x[0]) != null) {
                            return $confirm.notify("error", "The link already exists");
                        } else {
                            return $confirm.notify("error");
                        }
                    });

                } else if (event.keyCode === 27) {
                    target = angular.element(event.currentTarget);
                    $el.find(".new").addClass("hidden");
                    $el.find(".new input").val("");
                    return $el.find(".add-button").show();
                }
            });
        };

        return bindOnce($scope, $attrs.ngModel, render);
    };

    const link = function($scope, $el, $attrs) {
        linkWikiLinks($scope, $el, $attrs);

        return $scope.$on("$destroy", () => $el.off());
    };

    return {link};
};

function __guard__(value, transform) {
  return (typeof value !== "undefined" && value !== null) ? transform(value) : undefined;
}
