// Validation functions

const validateCommandName = (name) => {
    const regex = /^[a-z0-9_-]{1,32}$/;
    return regex.test(name);
};

const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const validateIPAddress = (ip) => {
    const regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    return regex.test(ip);
};

const validateDiscordId = (id) => {
    const regex = /^\d{17,19}$/;
    return regex.test(id);
};

const validateHexColor = (color) => {
    const regex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return regex.test(color);
};

const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

module.exports = {
    validateCommandName,
    validateEmail,
    validateIPAddress,
    validateDiscordId,
    validateHexColor,
    validateUrl
};
