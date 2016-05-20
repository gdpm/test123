module.exports = function(sequelize, DataTypes){
    return sequelize.define('player', {
        index: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        playerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        literalName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        riotName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        server: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
      classMethods: {
          associate: function(models){
              
          }
      }  
    });
}