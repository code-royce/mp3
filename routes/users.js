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
            email: req.body.email
        });

        // Reject a missing name or email.
        try {
            await user.validate();
        } catch (err) {
            return res.status(400).json({
                message: 'A user needs a name and a valid email', data: null
            });
        }

        try {
            // Reject any existing email.
            const sameEmail = await User.findOne({ email: user.email });
            if (sameEmail) {
                return res.status(400).json({
                    message: 'A user with that email already exists', data: null
                });
            }

            await user.save();
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
            // A malformed id can't belong to any user.
            if (err.name === 'CastError') {
                return res.status(404).json({
                    message: 'User not found', data: null
                });
            }
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
            // A malformed id can't belong to any user.
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
