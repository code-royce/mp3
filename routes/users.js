const User = require('../models/user.js');
const Task = require('../models/task.js');

module.exports = function (router) {

    const usersRoute = router.route('/users');

    // List users, all by default.
    usersRoute.get(async (req, res) => {

        // Reject invalid JSONs.
        let where, sort, select, skip, limit, count;
        try {
            where = JSON.parse(req.query.where || '{}');
            sort = JSON.parse(req.query.sort || '{}');
            select = JSON.parse(req.query.select || '{}');
            skip = JSON.parse(req.query.skip || '0');
            limit = JSON.parse(req.query.limit || '0');
            count = JSON.parse(req.query.count || 'false');
        } catch (err) {
            return res.status(400).json({
                message: 'Query parameters must be valid JSON', data: null
            });
        }

        try {
            // Return the number of matching users.
            if (count) {
                const total = await User.countDocuments(where);
                return res.status(200).json({ message: 'OK', data: total });
            }

            const users = await User
                .find(where)
                .sort(sort)
                .select(select)
                .skip(skip)
                .limit(limit);
            res.status(200).json({ message: 'OK', data: users });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Create a user from the request body.
    usersRoute.post(async (req, res) => {

        const user = new User({
            name: req.body.name,
            email: req.body.email,
            pendingTasks: req.body.pendingTasks
        });

        // Reject a missing name or email.
        try {
            await user.validate();
        } catch (err) {
            return res.status(400).json({
                message: 'A user needs a name and a valid email', data: null
            });
        }

        // Enforce list type for pendingTasks.
        if (req.body.pendingTasks !== undefined && !Array.isArray(req.body.pendingTasks)) {
            return res.status(400).json({
                message: 'pendingTasks must be a list of task ids', data: null
            });
        }

        // Reject pendingTasks with invalid ids.
        for (const id of user.pendingTasks) {
            if (!/^[0-9a-fA-F]{24}$/.test(id)) {
                return res.status(400).json({
                    message: 'pendingTasks has an invalid task id', data: null
                });
            }
        }

        try {
            // Reject existing emails.
            const sameEmail = await User.findOne({ email: user.email });
            if (sameEmail) {
                return res.status(400).json({
                    message: 'A user with that email already exists', data: null
                });
            }

            // Reject task ids that don't exist.
            const tasks = await Task.find({ _id: { $in: user.pendingTasks } });
            if (tasks.length !== user.pendingTasks.length) {
                return res.status(404).json({
                    message: 'A task in pendingTasks was not found', data: null
                });
            }

            // Reject completed tasks.
            if (tasks.some(task => task.completed)) {
                return res.status(400).json({
                    message: 'pendingTasks cannot include a completed task', data: null
                });
            }

            // Removethe tasks from existing users.
            await User.updateMany(
                { pendingTasks: { $in: user.pendingTasks } },
                { $pull: { pendingTasks: { $in: user.pendingTasks } } }
            );

            await user.save();

            // Assign the tasks to this user.
            await Task.updateMany(
                { _id: { $in: user.pendingTasks } },
                { assignedUser: user.id, assignedUserName: user.name }
            );
            res.status(201).json({ message: 'User created', data: user });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    const userRoute = router.route('/users/:id');

    // Get one user by id.
    userRoute.get(async (req, res) => {

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
            const user = await User.findById(req.params.id).select(select);
            if (!user) {
                return res.status(404).json({
                    message: 'User not found', data: null
                });
            }
            res.status(200).json({ message: 'OK', data: user });
        } catch (err) {
            // Check for malformed ids.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'User not found', data: null
                });
            }
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Replace one user by id.
    userRoute.put(async (req, res) => {

        // Reject ids that aren't associated with any user.
        let oldUser;
        try {
            oldUser = await User.findById(req.params.id);
            if (!oldUser) {
                return res.status(404).json({
                    message: 'User not found', data: null
                });
            }
        } catch (err) {
            // Check for malformed ids.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'User not found', data: null
                });
            }
            return res.status(500).json({ message: 'Server error', data: null });
        }

        // Build the new user, keeping the old id and dateCreated.
        const user = new User({
            _id: oldUser._id,
            name: req.body.name,
            email: req.body.email,
            pendingTasks: req.body.pendingTasks,
            dateCreated: oldUser.dateCreated
        });

        // Reject a missing name or email.
        try {
            await user.validate();
        } catch (err) {
            return res.status(400).json({
                message: 'A user needs a name and a valid email', data: null
            });
        }

        // Enforce list type for pendingTasks.
        if (req.body.pendingTasks !== undefined && !Array.isArray(req.body.pendingTasks)) {
            return res.status(400).json({
                message: 'pendingTasks must be a list of task ids', data: null
            });
        }

        // Reject pendingTasks with invalid ids.
        for (const id of user.pendingTasks) {
            if (!/^[0-9a-fA-F]{24}$/.test(id)) {
                return res.status(400).json({
                    message: 'pendingTasks has an invalid task id', data: null
                });
            }
        }

        try {
            // Reject existing emails.
            const sameEmail = await User.findOne({ email: user.email });
            if (sameEmail && sameEmail.id !== user.id) {
                return res.status(400).json({
                    message: 'A user with that email already exists', data: null
                });
            }

            // Reject task ids that don't exist.
            const tasks = await Task.find({ _id: { $in: user.pendingTasks } });
            if (tasks.length !== user.pendingTasks.length) {
                return res.status(404).json({
                    message: 'A task in pendingTasks was not found', data: null
                });
            }

            // Reject completed tasks.
            if (tasks.some(task => task.completed)) {
                return res.status(400).json({
                    message: 'pendingTasks cannot include a completed task', data: null
                });
            }

            // Unassign the user's old pending tasks.
            await Task.updateMany(
                { assignedUser: user.id, completed: false },
                { assignedUser: '', assignedUserName: 'unassigned' }
            );

            // Removethe tasks from existing users.
            await User.updateMany(
                { pendingTasks: { $in: user.pendingTasks } },
                { $pull: { pendingTasks: { $in: user.pendingTasks } } }
            );

            await User.replaceOne({ _id: user._id }, user.toObject());

            // Assign the tasks to this user.
            await Task.updateMany(
                { _id: { $in: user.pendingTasks } },
                { assignedUser: user.id, assignedUserName: user.name }
            );

            // Keep the user's name current on all of their tasks.
            await Task.updateMany(
                { assignedUser: user.id },
                { assignedUserName: user.name }
            );
            res.status(200).json({ message: 'OK', data: user });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: null });
        }
    });


    // Delete one user by id.
    userRoute.delete(async (req, res) => {
        try {
            const user = await User.findByIdAndDelete(req.params.id);
            if (!user) {
                return res.status(404).json({
                     message: 'User not found', data: null
                });
            }

            // Unassign all of the user's tasks.
            await Task.updateMany(
                { assignedUser: user.id },
                { assignedUser: '', assignedUserName: 'unassigned' }
            );
            res.status(204).end();
        } catch (err) {
            // Check for malformed ids.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'User not found', data: null
                });
            }
            res.status(500).json({ message: 'Server error', data: null });
        }
    });

    return router;
};
