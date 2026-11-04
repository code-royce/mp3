const Task = require('../models/task.js');
const User = require('../models/user.js');

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

         // Reject an assignedUser with an invalid id.
        if (task.assignedUser !== '' && !/^[0-9a-fA-F]{24}$/.test(task.assignedUser)) {
            return res.status(400).json({
                message: 'assignedUser is not a valid user id', data: null
            });
        }

        try {
            if (task.assignedUser === '') {
                // An unassigned task has no user name.
                task.assignedUserName = 'unassigned';
            } else {
                // Reject an assignedUser that doesn't exist.
                const user = await User.findById(task.assignedUser);
                if (!user) {
                    return res.status(404).json({
                        message: 'Assigned user not found', data: null
                    });
                }

                // Fill in the user's name if omitted.
                // Reject names that don't match the assigned user.
                if (req.body.assignedUserName === undefined) {
                    task.assignedUserName = user.name;
                } else if (task.assignedUserName !== user.name) {
                    return res.status(400).json({
                        message: 'assignedUserName does not match the assigned user', data: null
                    });
                }
            }

            await task.save();
            res.status(201).json({ message: 'Task created', data: task });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    const taskRoute = router.route('/tasks/:id');

    // Get one task by id.
    taskRoute.get(async (req, res) => {
        try {
            const task = await Task.findById(req.params.id);
            if (!task) {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
            res.status(200).json({ message: 'OK', data: task });
        } catch (err) {
            // A malformed id can't belong to any task.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Delete one task by id.
    // TODO: unassign this task's tasks once the tasks routes exist.
    taskRoute.delete(async (req, res) => {
        try {
            const task = await Task.findByIdAndDelete(req.params.id);
            if (!task) {
                return res.status(404).json({
                     message: 'Task not found', data: null
                });
            }
            res.status(204).end();
        } catch (err) {
            // A malformed id can't belong to any task.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
            res.status(500).json({ message: 'Server error', data: null });
        }
    });

    return router;
};
