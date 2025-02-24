const { DataTypes } = require('sequelize')

module.exports = (modelName, sequelize) => {
    return sequelize.define(modelName, {
        bid: DataTypes.INTEGER,
        date: DataTypes.STRING,
        time: DataTypes.STRING,
    }, {
        // Other model options go here
        timestamps: false
    })
}
