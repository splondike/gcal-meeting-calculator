/**
 * Called when we have the Google API, functions as DOMContentLoaded.
 */
function googleApiLoaded() {
    gapi.load('client:auth2', function() {
        gapi.client.init({
            apiKey: window.google_creds['api_key'],
            clientId: window.google_creds['client_id'],
            discoveryDocs: [
                "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
            ],
            scope: "https://www.googleapis.com/auth/calendar.readonly"
        }).then(function () {
            document.getElementById("loading_api").style.display = "none";

            gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
            updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        });
    });

}

/**
 * Downloads meeting data and formats it in a calculator friendly way.
 *
 * @param cache A keyvalue cache instance to save and load dates from.
 * @param startDate The minimum bound of the days to fetch.
 * @param endDate The maximum bkound of the days to fetch.
 * @return A promise that will resolve to the requested information.
 */
function fetchMeetings(startDate, endDate, calendarId) {
    return new Promise(function(resolve, reject) {
        var meetings = [];
        function fetchPage(pageToken) {
            var args = {
                'calendarId': calendarId,
                'timeMin': startDate.toISOString(),
                'timeMax': endDate.toISOString(),
                'singleEvents': true,
                'maxResults': 2500, // Maximum page size
                'orderBy': 'startTime'
            };

            if (pageToken) {
                args['pageToken'] = pageToken;
            }

            gapi.client.calendar.events.list(args).then(function(response) {
                var calendarOwnerEmail = response.result.summary;
                var events = response.result.items;
                var filteredEvents = events.filter(function(item) {
                    // Day long events get removed
                    if (typeof item["start"]["dateTime"] === "undefined") {
                        return false;
                    }

                    // Events with only one attendee get removed
                    if (!("attendees" in item) || (item["attendees"].length < 2)) {
                        return false;
                    }

                    // Events where the calendar owner has not accepted the invite
                    // get removed. Don't remove ones where they're not in the
                    // attendees, as they may have multiple emails
                    var email = calendarId === 'primary' ?
                        gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail() :
                        calendarId;
                    for(var i=0;i<item["attendees"].length;i++) {
                        var attendee = item["attendees"][i];
                        if (
                            attendee["email"] === email &&
                            attendee["responseStatus"] !== "accepted"
                        ) {
                            return false;
                        }
                    }

                    // Otherwise, include the meeting
                    return true;
                });
                filteredEvents.forEach(function(item) {
                    var start = item["start"]["dateTime"];
                    var end = item["end"]["dateTime"];

                    // Skip meetings that cross days
                    if (start.slice(0, 10) !== end.slice(0, 10)) {
                        return;
                    }

                    var day = parseDate(start.slice(0, 10));
                    meetings.push({
                        "dayId": getDayOfWeek(day),
                        "day": start.slice(0, 10), // 2020-01-01 type thing
                        "startTime": start.slice(11, 16), // 22:13 type thing
                        "endTime": end.slice(11, 16)
                    });
                });

                if (response.result.nextPageToken) {
                    fetchPage(response.result.nextPageToken);
                } else {
                    resolve(meetings);
                }
            }, console.error);
        }

        fetchPage(null);
    });
}

function loadSettingsToForm() {
    var query = parseQuery();
    var hasQuery = "start_work_time" in query;
    var range = getWeekRangeForDate(new Date());
    document.querySelectorAll("#settings form *[name]").forEach(function(elm) {
        var name = elm.getAttribute("name")
        var queryVal = query[name];

        if (elm.getAttribute("type") === "checkbox" && hasQuery) {
            elm.checked = queryVal === "on";
        } else if (elm.tagName === "SELECT" && queryVal) {
            if (queryVal !== 'primary') {
            var option = document.createElement("option");
                option.setAttribute("value", queryVal);
                option.setAttribute("selected", "selected");
                option.innerText = queryVal;
                elm.appendChild(option);
            }
        } else if (queryVal) {
            elm.value = queryVal;
        } else if (!hasQuery && name === "start_date") {
            elm.value = formatDate(range[0]);
        } else if (!hasQuery && name === "end_date") {
            elm.value = formatDate(range[1]);
        }
    });

    return hasQuery;
}

function loadWorkHoursFromForm() {
    var startTime = document.getElementById("start_work_time").value;
    var endTime = document.getElementById("end_work_time").value;
    var rtn = [];
    for(var i=0;i<7;i++) {
        if (document.getElementById("wd_" + i).checked) {
            rtn.push({
                "startTime": startTime,
                "endTime": endTime,
                "dayId": i
            });
        }
    }

    return rtn;
}

/**
 * Load the settings from the form to a hash
 */
function getSettings() {
    var startDate = parseDate(document.getElementById("start_date").value);
    var endDate = parseDate(document.getElementById("end_date").value);
    endDate.setHours(23);
    endDate.setMinutes(59);
    endDate.setSeconds(59);
    var calendarId = document.getElementById("calendar_input").value;

    return {
        "workHours": loadWorkHoursFromForm(),
        "startDate": startDate,
        "endDate": endDate,
        "calendarId": calendarId,
        "params": {
            "disruptionBeforeMinutes":
                parseInt(document.getElementById("disruption_before").value),
            "disruptionAfterMinutes":
                parseInt(document.getElementById("disruption_after").value),
            "minDeepWorkMinutes":
                parseInt(document.getElementById("min_deep_work").value),
        }
    }
}

function showSettingsForm() {
    document.getElementById("settings").style.display = "";
    gapi.client.calendar.calendarList.list().then(function(result) {
        var select = document.getElementById("calendar_input");
        result.result.items.forEach(function(item) {
            var updatedExisting = false;
            Array.prototype.forEach.call(select.children, function(option) {
                if (option.value === item.id) {
                    option.innerText = item.summary;
                    updatedExisting = true;
                }
            });
            if (!updatedExisting) {
                var option = document.createElement("option");
                option.setAttribute("value", item.id);
                option.innerText = item.summary;
                select.appendChild(option);
            }
        });
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        if (loadSettingsToForm()) {
            // Already have settings
            document.getElementById("loading_results").style.display = "";
            var showSettingsBtn = document.getElementById("show_settings");
            showSettingsBtn.addEventListener("click", function() {
                showSettingsForm();
                showSettingsBtn.style.display = "none";
            }, false);
            loadResults(getSettings());
        } else {
            // Still waiting for settings
            showSettingsForm();
        }

        document.getElementById("auth_to_google").style.display = "none";
    } else {
        var authButton = document.getElementById("auth_to_google");
        authButton.style.display = "";
        authButton.removeAttribute("disabled");
        authButton.addEventListener("click", function() {
            gapi.auth2.getAuthInstance().signIn();
        }, false);
    }
}

function loadResults(settings) {
    clearTable();
    fetchMeetings(settings.startDate, settings.endDate, settings.calendarId).then(function(meetings) {
        document.getElementById("loading_results").style.display = "none";
        document.getElementById("results").style.display = "";

        var meetingsByWeek = splitMeetingsByWeek(
            meetings,
            settings.workHours,
            settings.startDate,
            settings.endDate
        );
        renderResults(meetingsByWeek.map(function(weekData) {
            var result = calculateHours(
                weekData["workHours"],
                weekData["meetings"],
                settings.params
            );
            return {
                "startDate": weekData["startDate"],
                "endDate": weekData["endDate"],
                "shallowMinutes": result["shallowMinutes"],
                "deepMinutes": result["deepMinutes"],
                "meetingMinutes": result["meetingMinutes"]
            };
        }));
    });
}

/**
 * Splits a list of meetings output from fetchMeetings into a list of hashes containing
 * the start and end date of the week and the list of meetings in that week.
 *
 * Truncates the start and end boundaries if they fall outside [startDate, endDate].
 * Also included a copy of (possibly truncated) workHours along with each week.
 */
function splitMeetingsByWeek(meetings, workHours, startDate, endDate) {
    // Group meetings by the start of the week they occur in
    var meetingsMap = {};
    meetings.forEach(function(meeting) {
        var startOfWeek = getWeekRangeForDate(parseDate(meeting["day"]))[0].getTime();
        if (!(startOfWeek in meetingsMap)) {
            meetingsMap[startOfWeek] = [];
        }

        meetingsMap[startOfWeek].push(meeting);
    });

    // Build the return data structure
    var rtn = [];
    var currRefDate = startDate;
    do {
        var weekBoundary = getWeekRangeForDate(currRefDate);
        var weekId = weekBoundary[0].getTime();

        // Truncate the start and end bounds to fit [startDate, endDate]
        if (weekBoundary[0].getTime() < startDate.getTime()) {
            weekBoundary[0] = startDate;
        }
        if (weekBoundary[1].getTime() > endDate.getTime()) {
            weekBoundary[1] = endDate;
        }

        // Filter work hours to fit [startDate, endDate]
        var filteredWorkHours = workHours.filter(function(item) {
            if (item["dayId"] < getDayOfWeek(weekBoundary[0])) {
                return false;
            }
            if (item["dayId"] > getDayOfWeek(weekBoundary[1])) {
                return false;
            }

            return true;
        });

        rtn.push({
            "startDate": formatDate(weekBoundary[0]),
            "endDate": formatDate(weekBoundary[1]),
            "workHours": filteredWorkHours,
            "meetings": meetingsMap[weekId] || []
        });

        currRefDate = shiftDateByDays(currRefDate, 7, true);
    } while(currRefDate.getTime() <= endDate.getTime());

    return rtn;
}

function clearTable() {
    var container = document.getElementById("result_rows");
    container.innerHTML = '';
}

function renderResults(rows) {
    var container = document.getElementById("result_rows");
    var toClock = function(minutes) {
        var hours = Math.floor(minutes / 60);
        var mins = minutes % 60;
        return (hours < 10 ? "0" + hours : hours) + ":" + (mins < 10 ? "0" + mins : mins);
    };
    rows.forEach(function(row) {
        var tr = document.createElement("tr");
        tr.innerHTML =
            "<td>" + row["startDate"] + "</td>" +
            "<td class=\"to-cell\">" + row["endDate"] + "</td>";
        var graphNode = document.createElement("td");
        graphNode.className = "graph-cell";

        var categories = ["deep", "shallow", "meeting"];
        var totalMins = categories.reduce(function(acc, val) {
            return acc + row[val + "Minutes"];
        }, 0);
        categories.forEach(function(category) {
            var mins = row[category + "Minutes"];
            var td = document.createElement("td");
            td.className = "cell cell--" + category;
            td.innerText = toClock(mins);
            tr.appendChild(td);

            var div = document.createElement("div");
            div.className = "hbar hbar--" + category;
            div.style.width = 100*(mins / totalMins) + "%";
            graphNode.appendChild(div);
        });

        tr.appendChild(graphNode);
        container.appendChild(tr);
    });
}

function formatDate(date) {
    var zeroPad = function(num) {
        return (num < 10) ? "0" + num : num;
    };
    return [
        date.getFullYear(),
        zeroPad(date.getMonth() + 1),
        zeroPad(date.getDate())
    ].join("-");
}

function parseDate(dateStr) {
    var bits = dateStr.split("-").map(function(i) { return parseInt(i, 10);});;
    return new Date(bits[0], bits[1] - 1, bits[2], 0, 0, 0);
}

/**
 * @return An array with a Date object at the start of the week,
 *   and one at the end of the week (Sunday 11:59:59).
 */
function getWeekRangeForDate(date) {
    var dayOfWeek = getDayOfWeek(date);

    return [
        shiftDateByDays(date, -1 * dayOfWeek, true),
        shiftDateByDays(date, 6 - dayOfWeek, false),
    ];
}

function getDayOfWeek(date) {
    // Use Monday as 0, not Sunday
    return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

/**
 * Given a date, shift it the given number of days, and also
 * set the hour/minute/second to either the start of the day
 * 00:00:00 or the end 11:59:59
 *
 * return a new Date
 */
function shiftDateByDays(date, numDays, toStartOfDay) {
    // Because of daylight savings, just adding days
    // to the passed in date may not work to get us
    // to the next Sunday/previous Monday, so make
    // an origin that won't change days when the hour
    // jumps forward or back by one
    var originTimestamp = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        12
    ).getTime();

    var dayMillis = 24 * 60 * 60 * 1000;

    var newDay = new Date();
    newDay.setTime(originTimestamp + numDays * dayMillis);

    var hour = toStartOfDay ? 0 : 11;
    var minute = toStartOfDay ? 0 : 59;
    var second = toStartOfDay ? 0 : 59;

    return new Date(
        newDay.getFullYear(),
        newDay.getMonth(),
        newDay.getDate(),
        hour,
        minute,
        second
    );
}

function parseQuery() {
    var queryString = window.location.search;
    var query = {};
    var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
}

function assert(predicate) {
    if (!predicate) throw "Assertion error";
}
