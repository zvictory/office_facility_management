{
    'name': "Office Facility Management (Minimal)",
    'version': '18.0.1.0.0',
    'author': "AI-Generated ERP Solutions",
    'category': 'Services/Facilities',
    'depends': ['base', 'contacts', 'web'],  # Added 'web' for JS framework
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/sequence.xml',
        'views/building_views.xml',
        'views/floor_views.xml',
        'views/room_views.xml',
        'views/contract_views.xml',
        'views/dashboard.xml',
        'views/floorplan_dashboard.xml',  # Added new dashboard view
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            # Add JS files
            'office_facility_management/static/src/js/floor_plan_widget.js',
            # Add CSS files
            'office_facility_management/static/src/scss/floor_plan_widget.scss',
        ],
        'web.assets_qweb': [
            # Add QWeb templates
            'office_facility_management/static/src/xml/floor_plan_widget.xml',
        ],
    },
    'demo': ['demo/demo.xml'],
    'installable': True,
    'application': True,
}