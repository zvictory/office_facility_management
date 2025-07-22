{
    'name': "Office Facility Management (Minimal)",
    'version': '18.0.1.0.0',
    'author': "AI-Generated ERP Solutions",
    'category': 'Services/Facilities',
    'depends': ['base', 'contacts'],  # Added contacts for res.partner
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/sequence.xml',
        'views/building_views.xml',
        'views/floor_views.xml',
        'views/room_views.xml',
        'views/contract_views.xml',
        'views/dashboard.xml',
        'views/menu.xml',
    ],
'demo': ['demo/demo.xml'],
    'installable': True,
    'application': True,
}
