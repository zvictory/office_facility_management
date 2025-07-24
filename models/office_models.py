from odoo import models, fields, api

class BuildingInfo(models.Model):
    _name = 'building.info'
    _description = 'Building Information'

    name = fields.Char(string='Name', required=True)
    address = fields.Text(string='Address')
    floor_ids = fields.One2many('building.floor', 'building_id', string='Floors')
    room_count = fields.Integer(string='Total Rooms', compute='_compute_room_counts', store=False)
    occupied_room_count = fields.Integer(string='Occupied Rooms', compute='_compute_room_counts', store=False)

    def _compute_room_counts(self):
        for building in self:
            rooms = self.env['office.room'].search([('floor_id.building_id', '=', building.id)])
            building.room_count = len(rooms)
            building.occupied_room_count = len(rooms.filtered(lambda r: r.status == 'occupied'))

class BuildingFloor(models.Model):
    _name = 'building.floor'
    _description = 'Building Floor'

    name = fields.Char(string='Name', required=True)
    building_id = fields.Many2one('building.info', string='Building', required=True)
    room_ids = fields.One2many('office.room', 'floor_id', string='Rooms')

class OfficeRoom(models.Model):
    _name = 'office.room'
    _description = 'Office Room'

    name = fields.Char(string='Name', required=True)
    floor_id = fields.Many2one('building.floor', string='Floor', required=True)
    area = fields.Float(string='Area (m²)', required=True, default=45.0)
    status = fields.Selection([('available', 'Available'), ('occupied', 'Occupied')], default='available')
    current_contract_id = fields.Many2one('office.contract', string='Current Contract')
    is_status_editable = fields.Boolean(compute='_compute_is_status_editable')

    def _compute_is_status_editable(self):
        for room in self:
            room.is_status_editable = self.env.user.has_group('office_facility_management.group_facility_manager')

class OfficeContract(models.Model):
    _name = 'office.contract'
    _description = 'Office Contract'

    name = fields.Char(string='Reference', default=lambda self: self.env['ir.sequence'].next_by_code('office.contract'), readonly=True)
    room_id = fields.Many2one('office.room', string='Room', required=True)
    tenant_id = fields.Many2one('res.partner', string='Tenant', required=True)
    start_date = fields.Date(string='Start Date', required=True)
    end_date = fields.Date(string='End Date', required=True)
    monthly_rent = fields.Float(string='Monthly Rent', required=True)

    @api.onchange('room_id')
    def _onchange_room_id(self):
        if self.room_id:
            self.room_id.status = 'occupied' if self.end_date >= fields.Date.today() else 'available'
