const { DataTypes } = require('sequelize')

module.exports = (modelName, sequelize) => {
    return sequelize.define(modelName, {
        name: DataTypes.STRING,
        ip: DataTypes.STRING,
        port: DataTypes.INTEGER,
        timeout: DataTypes.INTEGER,
        logFile: DataTypes.STRING,
        endPoint: DataTypes.STRING,
        username: DataTypes.STRING,
        password: DataTypes.STRING,
        watching: DataTypes.BOOLEAN,
    }, {
        // Other model options go here
        timestamps: false
    })
}
