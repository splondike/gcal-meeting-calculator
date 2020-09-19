(function() {
/**
 * This script calculates the amount of time in meetings, out of meetings,
 * and disrupted by meetings given a list of work hours and a list of meetings.
 */

/**
 * A hours+minutes time without timezone
 */
function LocalTime(hours, minutes) {
    this.hours = hours;
    this.minutes = minutes;
    this.normalise();
}
LocalTime.prototype.normalise = function normalise() {
    while(this.minutes < 0) {
        this.minutes += 60;
        this.hours--;
    };
    while(this.minutes >= 60) {
        this.minutes -= 60;
        this.hours++;
    }
    this.hours = this.hours % 24;
    while(this.hours < 0) {
        this.hours += 24;
    };
};
LocalTime.prototype.add = function add(hours, minutes) {
    this.hours += hours;
    this.minutes += minutes;
    this.normalise();
};
LocalTime.prototype.subtract = function subtract(hours, minutes) {
    this.hours -= hours;
    this.minutes -= minutes;
    this.normalise();
};
LocalTime.prototype.toString = function toString() {
    var hourS = this.hours < 10 ? "0" + this.hours : "" + this.hours;
    var minuteS = this.minutes < 10 ? "0" + this.minutes : "" + this.minutes;

    return hourS + ":" + minuteS;
};
LocalTime.prototype.toMinutes = function toMinutes() {
    return this.hours * 60 + this.minutes;
}

LocalTime.compare = function compare(a, b) {
    var aVal = (a.hours * 60) + a.minutes;
    var bVal = (b.hours * 60) + b.minutes;

    if (aVal < bVal) {
        return -1;
    } else if (aVal > bVal) {
        return 1;
    } else {
        return 0;
    }
}
LocalTime.parseTime = function parseTime(time) {
    var bits = time.split(":").map(function(bit){return parseInt(bit, 10);});
    return new LocalTime(bits[0], bits[1]);
}

/**
 * Combines all overlapping or abutting meetings into single larger
 * blocks.
 */
function combineMeetings(sortedMeetings) {
    if (sortedMeetings.length === 0) {
        return [];
    }

    var rtn = [];
    var blockStartTime, blockEndTime;
    sortedMeetings.forEach(function(meeting) {
        if (typeof blockStartTime === "undefined") {
            blockStartTime = meeting["startTime"];
            blockEndTime = meeting["endTime"];
        } else if (
            LocalTime.compare(blockStartTime, meeting["startTime"]) < 1 &&
            LocalTime.compare(blockEndTime, meeting["startTime"]) > -1
        ) {
            blockEndTime = LocalTime.compare(blockEndTime, meeting["endTime"]) === -1 ?
                meeting["endTime"] : blockEndTime;
        } else {
            rtn.push({
                "startTime": blockStartTime,
                "endTime": blockEndTime
            });

            blockStartTime = meeting["startTime"];
            blockEndTime = meeting["endTime"];
        }
    });

    if (typeof blockStartTime !== "undefined") {
        rtn.push({
            "startTime": blockStartTime,
            "endTime": blockEndTime
        });
    }

    return rtn;
}

function calculateHours(workHours, meetings, params) {
    var shallowMinutes = 0;
    var meetingMinutes = 0;
    var deepMinutes = 0;
    var addNonMeetingMinutes = function(minsDiff) {
        if (params["minDeepWorkMinutes"] < minsDiff) {
            deepMinutes += minsDiff;
        } else {
            shallowMinutes += minsDiff;
        }
    }

    var disruptionBefore = params["disruptionBeforeMinutes"];
    var disruptionAfter = params["disruptionAfterMinutes"];

    // Extend all the meetings by disruptionBefore and disruptionAfter,
    // transforming their start/endtimes to LocalTime in the process
    var transformedMeetings = meetings.map(function(meeting) {
        var startTime = LocalTime.parseTime(meeting["startTime"]);
        startTime.subtract(0, disruptionBefore);

        var endTime = LocalTime.parseTime(meeting["endTime"]);
        endTime.add(0, disruptionAfter);

        return {
            "dayId": meeting["dayId"],
            "startTime": startTime,
            "endTime": endTime
        };
    });
    // Sort the meetings so the earliest start times sort first, then the ones
    // with the latest end time
    var sortedMeetings = transformedMeetings.sort(function(a, b) {
        var startCmp = LocalTime.compare(a["startTime"], b["startTime"]);
        if (startCmp !== 0) {
            return startCmp;
        }
        return LocalTime.compare(a["endTime"], b["endTime"]);
    });

    workHours.forEach(function(day) {
        var startWork = LocalTime.parseTime(day["startTime"]);
        var startWorkMins = startWork.toMinutes();
        var endWork = LocalTime.parseTime(day["endTime"]);
        var endWorkMins = endWork.toMinutes();
        var filteredMeetings = sortedMeetings.filter(function(meeting) {
            return meeting["dayId"] === day["dayId"];
        });
        var normalisedMeetings = combineMeetings(filteredMeetings);
        var toClippedMins = function(time) {
            return Math.min(
                endWorkMins,
                Math.max(
                    startWorkMins,
                    time.toMinutes()
                )
            )
        };

        // Handle the no meetings case
        if (normalisedMeetings.length === 0) {
            addNonMeetingMinutes(endWorkMins - startWorkMins);
            return;
        }

        // Add up all the meeting blocks
        var lastStartTime = startWork;
        normalisedMeetings.forEach(function(meeting) {
            if (LocalTime.compare(lastStartTime, meeting["startTime"]) === -1) {
                // There's some non-meeting time before the meeting
                addNonMeetingMinutes(
                    toClippedMins(meeting["startTime"]) - toClippedMins(lastStartTime)
                );
            }

            // Now add the meeting time
            meetingMinutes +=
                toClippedMins(meeting["endTime"]) - toClippedMins(meeting["startTime"]);
            lastStartTime = meeting["endTime"];
        });

        if (LocalTime.compare(lastStartTime, endWork) === -1) {
            addNonMeetingMinutes(
                toClippedMins(endWork) - toClippedMins(lastStartTime)
            );
        }
    });

    return {
        "shallowMinutes": shallowMinutes,
        "deepMinutes": deepMinutes,
        "meetingMinutes": meetingMinutes
    };
}

if (typeof exports !== "undefined") {
    exports.LocalTime = LocalTime;
    exports.calculateHours = calculateHours;
} else if (typeof window !== "undefined") {
    window.calculateHours = calculateHours;
}
})();
