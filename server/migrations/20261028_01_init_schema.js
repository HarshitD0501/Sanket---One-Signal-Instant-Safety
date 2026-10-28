const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Users table
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastKnownLocation: {
        type: DataTypes.JSONB,
        defaultValue: { lat: null, lng: null, updatedAt: null },
      },
      sosActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // 2. Emergency Contacts table
    await queryInterface.createTable('emergency_contacts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      relation: {
        type: DataTypes.ENUM('Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Other'),
        allowNull: false,
        defaultValue: 'Other',
      },
      whatsappEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      callEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('emergency_contacts', ['userId']);

    // 3. SOS Events table
    await queryInterface.createTable('sos_events', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      triggerType: {
        type: DataTypes.ENUM('tap', 'shake'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'resolved', 'false_alarm'),
        allowNull: false,
        defaultValue: 'active',
      },
      location: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: { lat: null, lng: null, address: '' },
      },
      trackingId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      trackingExpiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      resolvedAt: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('sos_events', ['userId']);
    await queryInterface.addIndex('sos_events', ['trackingId']);
    // AUDIT-001 / AUDIT-015: Partial unique index guaranteeing at most 1 active SOS per user
    await queryInterface.addIndex('sos_events', ['userId'], {
      unique: true,
      where: { status: 'active' },
      name: 'one_active_sos_per_user',
    });

    // 4. SOS Notifications table
    await queryInterface.createTable('sos_notifications', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sosEventId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'sos_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      contactId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      contactName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      contactPhone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      channel: {
        type: DataTypes.ENUM('whatsapp', 'voice_call'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('queued', 'sending', 'sent', 'delivered', 'failed', 'no-answer'),
        allowNull: false,
        defaultValue: 'queued',
      },
      attemptCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lastAttemptAt: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      lastError: {
        type: DataTypes.TEXT,
        defaultValue: null,
      },
      externalReference: {
        type: DataTypes.STRING,
        defaultValue: null,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('sos_notifications', ['sosEventId']);

    // 5. Location Points table
    await queryInterface.createTable('location_points', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sosEventId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'sos_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      lat: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      lng: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('location_points', ['sosEventId']);
    await queryInterface.addIndex('location_points', ['sosEventId', 'timestamp']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('location_points');
    await queryInterface.dropTable('sos_notifications');
    await queryInterface.dropTable('sos_events');
    await queryInterface.dropTable('emergency_contacts');
    await queryInterface.dropTable('users');
  },
};
