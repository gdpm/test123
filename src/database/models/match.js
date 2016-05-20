module.exports = function(sequelize, DataTypes){
    return sequelize.define('match', {
        index: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        playerId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        playerName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        matchId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        server: {
            type: DataTypes.STRING,
            allowNull: false
        },
        
        role: DataTypes.STRING,
        gpm: DataTypes.FLOAT,
        xppm: DataTypes.FLOAT,
        cspm: DataTypes.FLOAT,
        statspm: DataTypes.FLOAT,
        kda: DataTypes.FLOAT,
        kp: DataTypes.FLOAT
        
    }, {
      classMethods: {
          associate: function(models){
              
          }
      }  
    });
}