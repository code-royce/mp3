const Task = require('../models/task.js');

module.exports = function (router) {

    const tasksRoute = router.route('/tasks');

    // List tasks, at most 100 by default.
    tasksRoute.get(async (req, res) => {
        try {
            const tasks = await Task.find().limit(100);
            res.status(200).json({ message: 'OK', data: tasks });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Create a task from the request body.
    // TODO: add the task to its user's pendingTasks
    tasksRoute.post(async (req, res) => {

        const task = new Task({
            name: req.body.name,
            description: req.body.description,
            deadline: req.body.deadline,
            completed: req.body.completed,
            assignedUser: req.body.assignedUser,
            assignedUserName: req.body.assignedUserName
        });

        // Reject a missing name or deadline.
        try {
            await task.validate();
        } catch (err) {
            return res.status(400).json({
                message: 'A task needs a name and a valid deadline', data: null
            });
        }

        try {
            await task.save();
            res.status(201).json({ message: 'Task created', data: task });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });

    return router;
};
