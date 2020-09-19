const calculator = require('./calculator');

test("LocalTime works", () => {
    var lt = calculator.LocalTime.parseTime("01:12");
    lt.add(23, 48);
    expect(lt.toString()).toBe("01:00");

    lt.subtract(2, 3);
    expect(lt.toString()).toBe("22:57");

    lt.add(0, 120);
    expect(lt.toString()).toBe("00:57");

    lt.subtract(0, 58);
    expect(lt.toString()).toBe("23:59");
});

test("calculateHours handles meetings starting earlier than the day", () => {
    // Given a workday and a meeting that starts before the workday
    var params = {"disruptionBeforeMinutes": 0, "disruptionAfterMinutes": 0, "minDeepWorkMinutes": 0};
    var workDays = [{"startTime": "09:00", "endTime": "17:00", "dayId": "day"}];
    var meetings = [{"startTime": "08:00", "endTime": "10:00", "dayId": "day"}];

    // When the calculator runs
    var result = calculator.calculateHours(workDays, meetings, params);

    // Then the overlapping meeting is taken into account
    expect(result["meetingMinutes"]).toBe(60);
    expect(result["deepMinutes"]).toBe(420);
    expect(result["shallowMinutes"]).toBe(0);
});

test("calculateHours sums up complex hours correctly", () => {
    // Given a workday and a meeting that starts before the workday
    var params = {"disruptionBeforeMinutes": 0, "disruptionAfterMinutes": 0, "minDeepWorkMinutes": 0};
    var workDays = [{"startTime": "09:00", "endTime": "17:00", "dayId": "day"}];
    var meetings = [
        {"startTime": "09:01", "endTime": "10:01", "dayId": "day"},
        {"startTime": "11:01", "endTime": "11:30", "dayId": "day"},
        {"startTime": "11:02", "endTime": "11:05", "dayId": "day"},
        {"startTime": "11:29", "endTime": "11:31", "dayId": "day"},
        {"startTime": "12:00", "endTime": "14:00", "dayId": "day"},
    ];

    // When the calculator runs
    var result = calculator.calculateHours(workDays, meetings, params);

    // Then the results are as expected
    expect(result["meetingMinutes"]).toBe(210);
    expect(result["deepMinutes"]).toBe(270);
    expect(result["shallowMinutes"]).toBe(0);
});

test("calculateHours calculates shallow time", () => {
    // Given a workday and a meeting that starts before the workday
    var params = {"disruptionBeforeMinutes": 0, "disruptionAfterMinutes": 0, "minDeepWorkMinutes": 30};
    var workDays = [{"startTime": "09:00", "endTime": "17:00", "dayId": "day"}];
    var meetings = [
        {"startTime": "09:30", "endTime": "10:00", "dayId": "day"},
        {"startTime": "10:31", "endTime": "12:00", "dayId": "day"},
    ];

    // When the calculator runs
    var result = calculator.calculateHours(workDays, meetings, params);

    // Then the results are as expected
    expect(result["meetingMinutes"]).toBe(119);
    expect(result["deepMinutes"]).toBe(331);
    expect(result["shallowMinutes"]).toBe(30);
});

test("calculateHours uses disruption", () => {
    // Given a workday and a meeting that starts before the workday
    var params = {"disruptionBeforeMinutes": 30, "disruptionAfterMinutes": 10, "minDeepWorkMinutes": 30};
    var workDays = [{"startTime": "09:00", "endTime": "17:00", "dayId": "day"}];
    var meetings = [
        {"startTime": "10:00", "endTime": "11:00", "dayId": "day"},
    ];

    // When the calculator runs
    var result = calculator.calculateHours(workDays, meetings, params);

    // Then the results are as expected
    expect(result["meetingMinutes"]).toBe(100);
    expect(result["deepMinutes"]).toBe(350);
    expect(result["shallowMinutes"]).toBe(30);
});

test("calculateHours works OK", () => {
    // Given a workday and a meeting that starts before the workday
    var params = {"disruptionBeforeMinutes": 5, "disruptionAfterMinutes": 10, "minDeepWorkMinutes": 60};
    var workDays = [{"startTime": "09:00", "endTime": "17:00", "dayId": 0}, {"startTime": "09:00", "endTime": "17:00", "dayId": 1}, {"startTime": "09:00", "endTime": "17:00", "dayId": 2}, {"startTime": "09:00", "endTime": "17:00", "dayId": 3}, {"startTime": "09:00", "endTime": "17:00", "dayId": 4}];
    var meetings = [
        {dayId: 2, day: "2020-09-08", startTime: "09:00", endTime: "15:00"},
        {dayId: 2, day: "2020-09-08", startTime: "09:45", endTime: "10:00"},
        {dayId: 2, day: "2020-09-08", startTime: "10:00", endTime: "10:30"},
        {dayId: 2, day: "2020-09-08", startTime: "10:30", endTime: "10:45"},
        {dayId: 2, day: "2020-09-08", startTime: "14:00", endTime: "15:00"}
    ];

    // When the calculator runs
    var result = calculator.calculateHours(workDays, meetings, params);

    // Then the results are as expected
    console.log(result);
    // expect(result["meetingMinutes"]).toBe(100);
    // expect(result["deepMinutes"]).toBe(350);
    // expect(result["shallowMinutes"]).toBe(30);
});
