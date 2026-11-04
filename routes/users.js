const User = require('../models/user.js');

module.exports = function (router) {

    const usersRoute = router.route('/users');

    // List all users.
    usersRoute.get(async (req, res) => {
        try {
            const users = await User.find();
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
                message: 'A user needs a name and an email', data: null
            });
        }

        try {
            // Reject an email another user already has.
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

    return router;
};
