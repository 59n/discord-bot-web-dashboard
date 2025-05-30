// Helper functions for common operations

const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
};

const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
};

const truncateString = (str, maxLength) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
};

const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>]/g, '');
};

module.exports = {
    formatUptime,
    formatNumber,
    truncateString,
    generateId,
    isValidUrl,
    sanitizeInput
};
