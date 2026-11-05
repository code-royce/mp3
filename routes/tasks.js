const Task = require('../models/task.js');
const User = require('../models/user.js');

module.exports = function (router) {

    const tasksRoute = router.route('/tasks');

    // List tasks, max 100 by default.
    tasksRoute.get(async (req, res) => {

        // Reject invalid JSONs.
        let where, sort, select, skip, limit, count;
        try {
            where = JSON.parse(req.query.where || '{}');
            sort = JSON.parse(req.query.sort || '{}');
            select = JSON.parse(req.query.select || '{}');
            skip = JSON.parse(req.query.skip || '0');
            limit = JSON.parse(req.query.limit || '100');
            count = JSON.parse(req.query.count || 'false')
        } catch (err) {
            return res.status(400).json({
                message: 'Query parameters must be valid JSON', data: null
            });
        }

        try {
            // Return number of matching tasks.
            if (count) {
                const total = await Task.countDocuments(where);
                return res.status(200).json({ message: 'Engage.', data: total })
            }

            const tasks = await Task
                .find(where)
                .sort(sort)
                .select(select)
                .skip(skip)
                .limit(limit);
            res.status(200).json({ message: 'Engage.', data: tasks });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Create a task from the request body.
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

         // Reject assignedUsers with invalid ids.
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
                // Reject assignedUsers that don't exist.
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

            // Add incomplete tasks to their user's pendingTasks.
            if (task.assignedUser !== '' && !task.completed) {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $push: { pendingTasks: task.id } }
                );
            }
            res.status(201).json({ message: 'Task created. Make it so.', data: task });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    const taskRoute = router.route('/tasks/:id');

    // Get one task by id.
    taskRoute.get(async (req, res) => {

        // Reject invalid JSONs.
        let select;
        try {
            select = JSON.parse(req.query.select || '{}');
        } catch (err) {
            return res.status(400).json({
                message: 'Query parameters must be valid JSON', data: null
            });
        }

        try {
            const task = await Task.findById(req.params.id).select(select);
            if (!task) {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
            res.status(200).json({ message: 'Engage.', data: task });
        } catch (err) {
            // Check for malformed ids.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Replace one task by id.
    taskRoute.put(async (req, res) => {

        // Reject ids that aren't associated with any task.
        let oldTask;
        try {
            oldTask = await Task.findById(req.params.id);
            if (!oldTask) {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
        } catch (err) {
            // Check for malformed ids.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'Task not found', data: null
                });
            }
            return res.status(500).json({ message: 'Server error', data: null });
        }

        // Build the new task, keeping the old id and dateCreated.
        const task = new Task({
            _id: oldTask._id,
            name: req.body.name,
            description: req.body.description,
            deadline: req.body.deadline,
            completed: req.body.completed,
            assignedUser: req.body.assignedUser,
            assignedUserName: req.body.assignedUserName,
            dateCreated: oldTask.dateCreated
        });

        // Reject a missing name or deadline.
        try {
            await task.validate();
        } catch (err) {
            return res.status(400).json({
                message: 'A task needs a name and a valid deadline', data: null
            });
        }

        // Reject assignedUsers with invalid ids.
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
                // Reject assignedUsers that don't exist.
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

            await Task.replaceOne({ _id: task._id }, task.toObject());

            // Remove the task from the previous user's pendingTasks.
            if (oldTask.assignedUser !== '') {
                await User.updateOne(
                    { _id: oldTask.assignedUser },
                    { $pull: { pendingTasks: task.id } }
                );
            }

            // Add incomplete tasks to their user's pendingTasks.
            if (task.assignedUser !== '' && !task.completed) {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $push: { pendingTasks: task.id } }
                );
            }
            res.status(200).json({ message: 'Engage.', data: task });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Delete one task by id.
    taskRoute.delete(async (req, res) => {
        try {
            const task = await Task.findByIdAndDelete(req.params.id);
            if (!task) {
                return res.status(404).json({
                     message: 'Task not found', data: null
                });
            }

            // Remove task from its user's pendingTasks.
            if (task.assignedUser !== '') {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $pull: { pendingTasks: task.id } }
                );
            }
            res.status(204).end();
        } catch (err) {
            // Check for malformed ids.
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
