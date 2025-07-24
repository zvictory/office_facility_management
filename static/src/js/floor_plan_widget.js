// File: static/src/js/floor_plan_widget.js
odoo.define('office_facility_management.FloorPlanWidget', function (require) {
    "use strict";

    const AbstractField = require('web.AbstractField');
    const core = require('web.core');
    const registry = require('web.field_registry');
    const QWeb = core.qweb;
    const _t = core._t;
    
    const FloorPlanWidget = AbstractField.extend({
        template: 'FloorPlanWidgetTemplate',
        events: {
            'click .building-tab': '_onBuildingTabClick',
            'click .floor-tab': '_onFloorTabClick',
            'click .metric-btn': '_onMetricButtonClick',
            'click .legend-item': '_onLegendItemClick',
            'click .close-details': '_onCloseDetailsClick',
            // Room events are delegated in _setupEventListeners
        },
        
        init: function () {
            this._super.apply(this, arguments);
            this.currentState = {
                building: 'A',
                floor: '1',
                metric: 'rentPerSqm'
            };
            this.metrics = {
                rentPerSqm: {
                    title: 'Аренда за м²',
                    getValueForRoom: (roomId, roomData) => {
                        return roomData.rent_per_sqm || 0;
                    },
                    formatValue: (value) => `$${value.toFixed(2)}/м²`,
                    colorScale: [
                        { value: 0, color: '#9ca3af' }, // Vacant
                        { value: 4.0, color: '#93c5fd' }, // Low
                        { value: 4.5, color: '#34d399' }, // Medium
                        { value: 4.8, color: '#fbbf24' }, // High
                        { value: 5.0, color: '#f87171' }  // Very high
                    ],
                    legendTitle: 'Аренда за квадратный метр'
                },
                totalRent: {
                    title: 'Общая аренда',
                    getValueForRoom: (roomId, roomData) => {
                        return (roomData.rent_per_sqm || 0) * (roomData.area || 0);
                    },
                    formatValue: (value) => this._formatCurrency(value),
                    colorScale: [
                        { value: 0, color: '#9ca3af' }, // Vacant
                        { value: 150, color: '#93c5fd' }, // Low
                        { value: 200, color: '#34d399' }, // Medium
                        { value: 250, color: '#fbbf24' }, // High
                        { value: 300, color: '#f87171' }  // Very high
                    ],
                    legendTitle: 'Ежемесячная аренда'
                },
                occupancyStatus: {
                    title: 'Статус занятости',
                    getValueForRoom: (roomId, roomData) => {
                        return roomData.status === 'occupied' ? 1 : 0;
                    },
                    formatValue: (value) => value === 1 ? 'Занято' : 'Свободно',
                    colorScale: [
                        { value: 0, color: '#9ca3af' }, // Vacant
                        { value: 1, color: '#34d399' }  // Occupied
                    ],
                    legendTitle: 'Статус занятости'
                },
                contractDuration: {
                    title: 'Срок контракта',
                    getValueForRoom: (roomId, roomData) => {
                        return roomData.contract_duration || 0;
                    },
                    formatValue: (value) => value === 0 ? 'Нет контракта' : `${value} месяцев`,
                    colorScale: [
                        { value: 0, color: '#9ca3af' }, // Vacant
                        { value: 12, color: '#93c5fd' }, // 1 year
                        { value: 24, color: '#34d399' }, // 2 years
                        { value: 36, color: '#fbbf24' }, // 3 years
                        { value: 48, color: '#f87171' }  // 4+ years
                    ],
                    legendTitle: 'Срок контракта'
                },
                depositAmount: {
                    title: 'Сумма депозита',
                    getValueForRoom: (roomId, roomData) => {
                        return roomData.deposit_amount || 0;
                    },
                    formatValue: (value) => this._formatCurrency(value),
                    colorScale: [
                        { value: 0, color: '#9ca3af' }, // Vacant
                        { value: 4000, color: '#93c5fd' }, // Low
                        { value: 5000, color: '#34d399' }, // Medium
                        { value: 6000, color: '#fbbf24' }, // High
                        { value: 7000, color: '#f87171' }  // Very high
                    ],
                    legendTitle: 'Сумма депозита'
                },
                businessType: {
                    title: 'Тип бизнеса',
                    getValueForRoom: (roomId, roomData) => {
                        return roomData.business_type || 'Свободно';
                    },
                    formatValue: (value) => value,
                    colorScale: [
                        { value: 'Свободно', color: '#9ca3af' },
                        { value: 'IT-компания', color: '#60a5fa' },
                        { value: 'Архитектура', color: '#c084fc' },
                        { value: 'Юридические услуги', color: '#34d399' },
                        { value: 'Маркетинг', color: '#f97316' },
                        { value: 'Страхование', color: '#f43f5e' },
                        { value: 'Дизайн', color: '#14b8a6' },
                        { value: 'Медицина', color: '#374151' },
                        { value: 'Туризм', color: '#fbbf24' },
                        { value: 'Бухгалтерия', color: '#b45309' },
                        { value: 'Образование', color: '#059669' },
                        { value: 'Реклама', color: '#8b5cf6' },
                        { value: 'Консалтинг', color: '#0ea5e9' }
                    ],
                    legendTitle: 'Типы бизнеса'
                }
            };
        },
        
        start: function () {
            return this._super.apply(this, arguments).then(() => {
                this._loadData().then(() => {
                    this._renderFloorPlans();
                    this._updateLegend(this.currentState.metric);
                    this._updateSummary();
                    this._setupEventListeners();
                    this._changeFloorPlan('A', '1');
                });
            });
        },
        
        _loadData: function() {
            return new Promise((resolve) => {
                // Load buildings and floors
                this._rpc({
                    model: 'building.info',
                    method: 'search_read',
                    fields: ['name', 'address']
                }).then(buildingData => {
                    this.buildings = {};
                    
                    const buildingPromises = buildingData.map(building => {
                        return this._rpc({
                            model: 'building.floor',
                            method: 'search_read',
                            domain: [['building_id', '=', building.id]],
                            fields: ['name']
                        }).then(floorData => {
                            const buildingKey = building.name.includes('A') ? 'A' : 'B';
                            if (!this.buildings[buildingKey]) {
                                this.buildings[buildingKey] = {
                                    name: building.name,
                                    floors: {}
                                };
                            }
                            
                            const floorPromises = floorData.map(floor => {
                                const floorKey = floor.name.includes('1') ? '1' : '2';
                                
                                return this._rpc({
                                    model: 'office.room',
                                    method: 'search_read',
                                    domain: [['floor_id', '=', floor.id]],
                                    fields: ['name', 'status', 'area', 'current_contract_id']
                                }).then(roomData => {
                                    const contractIds = roomData
                                        .filter(room => room.current_contract_id)
                                        .map(room => room.current_contract_id[0]);
                                    
                                    if (contractIds.length) {
                                        return this._rpc({
                                            model: 'office.contract',
                                            method: 'search_read',
                                            domain: [['id', 'in', contractIds]],
                                            fields: ['room_id', 'tenant_id', 'start_date', 'end_date', 'monthly_rent']
                                        }).then(contractData => {
                                            if (!this.buildings[buildingKey].floors[floorKey]) {
                                                this.buildings[buildingKey].floors[floorKey] = {
                                                    name: floor.name,
                                                    rooms: this._processRooms(roomData, contractData, floor.id),
                                                    corridors: [{
                                                        x: 250, 
                                                        y: 30, 
                                                        width: 100, 
                                                        height: 840, 
                                                        name: "КОРИДОР"
                                                    }]
                                                };
                                            }
                                        });
                                    } else {
                                        if (!this.buildings[buildingKey].floors[floorKey]) {
                                            this.buildings[buildingKey].floors[floorKey] = {
                                                name: floor.name,
                                                rooms: this._processRooms(roomData, [], floor.id),
                                                corridors: [{
                                                    x: 250, 
                                                    y: 30, 
                                                    width: 100, 
                                                    height: 840, 
                                                    name: "КОРИДОР"
                                                }]
                                            };
                                        }
                                        return Promise.resolve();
                                    }
                                });
                            });
                            
                            return Promise.all(floorPromises);
                        });
                    });
                    
                    Promise.all(buildingPromises).then(() => {
                        resolve();
                    });
                });
            });
        },
        
        _processRooms: function(roomData, contractData, floorId) {
            // Transform room data into our expected format with positions
            const processedRooms = [];
            const leftRooms = roomData.filter((_, idx) => idx % 2 === 0);
            const rightRooms = roomData.filter((_, idx) => idx % 2 === 1);
            
            // Process left rooms
            leftRooms.forEach((room, idx) => {
                const contract = contractData.find(c => c.room_id && c.room_id[0] === room.id);
                const yPos = 30 + (idx * 140);
                
                const roomInfo = {
                    id: room.name,
                    x: 50,
                    y: yPos,
                    width: 200,
                    height: 120,
                    area: room.area || 45,
                    occupied: room.status === 'occupied',
                    status: room.status,
                    name: room.name,
                    odooId: room.id,
                    floorId: floorId
                };
                
                if (contract) {
                    // Add contract info
                    const tenant = contract.tenant_id;
                    roomInfo.tenant_name = tenant[1];
                    roomInfo.tenant_id = tenant[0];
                    roomInfo.rent_per_sqm = contract.monthly_rent / roomInfo.area;
                    roomInfo.start_date = contract.start_date;
                    roomInfo.end_date = contract.end_date;
                    roomInfo.monthly_rent = contract.monthly_rent;
                    
                    // Calculate contract duration in months
                    const startDate = new Date(contract.start_date);
                    const endDate = new Date(contract.end_date);
                    roomInfo.contract_duration = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                             (endDate.getMonth() - startDate.getMonth());
                    
                    roomInfo.deposit_amount = contract.monthly_rent * 2; // Assuming deposit is 2 months rent
                    
                    // Assign a business type based on the tenant name (in a real implementation this would come from tenant data)
                    const businessTypes = ['IT-компания', 'Архитектура', 'Юридические услуги', 'Маркетинг', 
                                          'Страхование', 'Дизайн', 'Медицина', 'Туризм', 'Бухгалтерия', 
                                          'Образование', 'Реклама', 'Консалтинг'];
                    const hash = tenant[0] % businessTypes.length;
                    roomInfo.business_type = businessTypes[hash];
                }
                
                processedRooms.push(roomInfo);
            });
            
            // Process right rooms
            rightRooms.forEach((room, idx) => {
                const contract = contractData.find(c => c.room_id && c.room_id[0] === room.id);
                const yPos = 30 + (idx * 140);
                
                const roomInfo = {
                    id: room.name,
                    x: 350,
                    y: yPos,
                    width: 200,
                    height: 120,
                    area: room.area || 45,
                    occupied: room.status === 'occupied',
                    status: room.status,
                    name: room.name,
                    odooId: room.id,
                    floorId: floorId
                };
                
                if (contract) {
                    // Add contract info
                    const tenant = contract.tenant_id;
                    roomInfo.tenant_name = tenant[1];
                    roomInfo.tenant_id = tenant[0];
                    roomInfo.rent_per_sqm = contract.monthly_rent / roomInfo.area;
                    roomInfo.start_date = contract.start_date;
                    roomInfo.end_date = contract.end_date;
                    roomInfo.monthly_rent = contract.monthly_rent;
                    
                    // Calculate contract duration in months
                    const startDate = new Date(contract.start_date);
                    const endDate = new Date(contract.end_date);
                    roomInfo.contract_duration = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                             (endDate.getMonth() - startDate.getMonth());
                    
                    roomInfo.deposit_amount = contract.monthly_rent * 2; // Assuming deposit is 2 months rent
                    
                    // Assign a business type based on the tenant name
                    const businessTypes = ['IT-компания', 'Архитектура', 'Юридические услуги', 'Маркетинг', 
                                          'Страхование', 'Дизайн', 'Медицина', 'Туризм', 'Бухгалтерия', 
                                          'Образование', 'Реклама', 'Консалтинг'];
                    const hash = tenant[0] % businessTypes.length;
                    roomInfo.business_type = businessTypes[hash];
                }
                
                processedRooms.push(roomInfo);
            });
            
            return processedRooms;
        },
        
        _renderFloorPlans: function() {
            // For each building and floor, render the floor plan
            for (const buildingKey in this.buildings) {
                const building = this.buildings[buildingKey];
                for (const floorKey in building.floors) {
                    const floor = building.floors[floorKey];
                    this._renderFloorPlan(buildingKey, floorKey, floor);
                }
            }
        },
        
        _renderFloorPlan: function(buildingKey, floorKey, floor) {
            const floorPlanContainer = this.el.querySelector(`#floorplan-${buildingKey}${floorKey}`);
            
            // Create SVG element
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgEl.setAttribute('width', '600');
            svgEl.setAttribute('height', '900');
            svgEl.setAttribute('viewBox', '0 0 600 900');
            svgEl.setAttribute('class', 'floor-plan');
            
            // Create the outer walls
            const outerWall = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            outerWall.setAttribute('x', '20');
            outerWall.setAttribute('y', '20');
            outerWall.setAttribute('width', '560');
            outerWall.setAttribute('height', '860');
            outerWall.setAttribute('fill', 'none');
            outerWall.setAttribute('stroke', '#333');
            outerWall.setAttribute('stroke-width', '4');
            svgEl.appendChild(outerWall);
            
            // Add corridors
            if (floor.corridors) {
                floor.corridors.forEach(corridor => {
                    const corridorEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    corridorEl.setAttribute('class', 'corridor');
                    corridorEl.setAttribute('x', corridor.x);
                    corridorEl.setAttribute('y', corridor.y);
                    corridorEl.setAttribute('width', corridor.width);
                    corridorEl.setAttribute('height', corridor.height);
                    corridorEl.setAttribute('fill', '#f9f9f9');
                    corridorEl.setAttribute('stroke', '#333');
                    corridorEl.setAttribute('stroke-width', '1');
                    corridorEl.setAttribute('stroke-dasharray', '5,5');
                    corridorEl.setAttribute('opacity', '0.5');
                    svgEl.appendChild(corridorEl);
                    
                    // Add corridor label
                    const corridorLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    corridorLabel.setAttribute('x', (corridor.x + corridor.width / 2).toString());
                    corridorLabel.setAttribute('y', (corridor.y + 100).toString());
                    corridorLabel.setAttribute('text-anchor', 'middle');
                    corridorLabel.setAttribute('font-size', '12');
                    corridorLabel.setAttribute('font-weight', 'bold');
                    corridorLabel.textContent = corridor.name || "КОРИДОР";
                    svgEl.appendChild(corridorLabel);
                });
            }
            
            // Add rooms
            floor.rooms.forEach(room => {
                // Room rectangle
                const roomRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                roomRect.setAttribute('class', 'room');
                roomRect.setAttribute('id', `${room.id.replace(/[^a-zA-Z0-9]/g, '_')}_${buildingKey}${floorKey}`);
                roomRect.setAttribute('x', room.x.toString());
                roomRect.setAttribute('y', room.y.toString());
                roomRect.setAttribute('width', room.width.toString());
                roomRect.setAttribute('height', room.height.toString());
                roomRect.setAttribute('data-room-id', room.id);
                roomRect.setAttribute('data-occupied', room.occupied.toString());
                roomRect.setAttribute('data-odoo-id', room.odooId.toString());
                roomRect.setAttribute('data-floor-id', room.floorId.toString());
                roomRect.setAttribute('stroke', '#333');
                roomRect.setAttribute('stroke-width', '1');
                roomRect.setAttribute('fill', room.occupied ? '#93c5fd' : '#9ca3af');
                svgEl.appendChild(roomRect);
                
                // Room label
                const roomLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                roomLabel.setAttribute('class', 'room-label');
                roomLabel.setAttribute('x', (room.x + room.width / 2).toString());
                roomLabel.setAttribute('y', (room.y + room.height / 2).toString());
                roomLabel.setAttribute('text-anchor', 'middle');
                roomLabel.setAttribute('dominant-baseline', 'middle');
                roomLabel.textContent = room.id;
                svgEl.appendChild(roomLabel);
                
                // Room area label
                const areaLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                areaLabel.setAttribute('class', 'room-area');
                areaLabel.setAttribute('x', (room.x + room.width / 2).toString());
                areaLabel.setAttribute('y', (room.y + room.height / 2 + 20).toString());
                areaLabel.setAttribute('text-anchor', 'middle');
                areaLabel.setAttribute('dominant-baseline', 'middle');
                areaLabel.textContent = `${room.area} м²`;
                svgEl.appendChild(areaLabel);
                
                // If the room has a name, add it
                if (room.name && room.name !== room.id) {
                    const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    nameLabel.setAttribute('class', 'room-name');
                    nameLabel.setAttribute('x', (room.x + room.width / 2).toString());
                    nameLabel.setAttribute('y', (room.y + room.height / 2 - 20).toString());
                    nameLabel.setAttribute('text-anchor', 'middle');
                    nameLabel.setAttribute('dominant-baseline', 'middle');
                    nameLabel.textContent = room.name;
                    svgEl.appendChild(nameLabel);
                }
                
                // Add door based on room position
                const x = room.x;
                const y = room.y;
                const width = room.width;
                const height = room.height;
                
                if (x < 300) {
                    // Left side rooms, door on right (to corridor)
                    const door = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    door.setAttribute('x', (x + width).toString());
                    door.setAttribute('y', (y + height / 2 - 10).toString());
                    door.setAttribute('width', '5');
                    door.setAttribute('height', '20');
                    door.setAttribute('fill', '#333');
                    svgEl.appendChild(door);
                } else {
                    // Right side rooms, door on left (to corridor)
                    const door = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    door.setAttribute('x', (x - 5).toString());
                    door.setAttribute('y', (y + height / 2 - 10).toString());
                    door.setAttribute('width', '5');
                    door.setAttribute('height', '20');
                    door.setAttribute('fill', '#333');
                    svgEl.appendChild(door);
                }
            });
            
            floorPlanContainer.innerHTML = '';
            floorPlanContainer.appendChild(svgEl);
        },
        
        _updateLegend: function(metricName) {
            const metric = this.metrics[metricName];
            const legendContainer = this.el.querySelector('#legend-items');
            legendContainer.innerHTML = '';
            
            const legendTitle = document.createElement('div');
            legendTitle.textContent = metric.legendTitle;
            legendTitle.style.fontWeight = 'bold';
            legendTitle.style.marginBottom = '8px';
            legendContainer.appendChild(legendTitle);
            
            metric.colorScale.forEach(item => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.setAttribute('data-value', item.value);
                
                const colorBox = document.createElement('div');
                colorBox.className = 'color-box';
                colorBox.style.backgroundColor = item.color;
                
                const label = document.createElement('span');
                
                if (metricName === 'businessType') {
                    label.textContent = item.value;
                } else if (metricName === 'occupancyStatus') {
                    label.textContent = item.value === 0 ? 'Свободно' : 'Занято';
                } else {
                    // For numerical metrics
                    if (item.value === 0) {
                        label.textContent = 'Свободно';
                    } else {
                        const nextIndex = metric.colorScale.indexOf(item) + 1;
                        if (nextIndex < metric.colorScale.length) {
                            const nextValue = metric.colorScale[nextIndex].value;
                            label.textContent = `${metric.formatValue(item.value)} - ${metric.formatValue(nextValue)}`;
                        } else {
                            label.textContent = `${metric.formatValue(item.value)}+`;
                        }
                    }
                }
                
                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                legendContainer.appendChild(legendItem);
                
                // Make legend items clickable to filter
                legendItem.addEventListener('click', () => {
                    this._showLegendSummary(metricName, item.value);
                });
            });
        },
        
        _updateMetricColors: function(metricName) {
            const metric = this.metrics[metricName];
            const currentBuilding = this.currentState.building;
            const currentFloor = this.currentState.floor;
            const floor = this.buildings[currentBuilding].floors[currentFloor];
            
            const rooms = this.el.querySelectorAll(`#floorplan-${currentBuilding}${currentFloor} .room`);
            
            rooms.forEach(roomElement => {
                const roomId = roomElement.getAttribute('data-room-id');
                const roomData = floor.rooms.find(r => r.id === roomId) || {};
                const value = metric.getValueForRoom(roomId, roomData);
                
                // Find the color for this value
                let color;
                if (metricName === 'businessType') {
                    // For business type, exact match
                    const colorItem = metric.colorScale.find(item => item.value === value);
                    color = colorItem ? colorItem.color : '#9ca3af';
                } else {
                    // For numerical metrics, find appropriate range
                    if (value === 0) {
                        color = metric.colorScale[0].color; // Vacant color
                    } else {
                        // Find the highest threshold that is less than or equal to the value
                        let colorItem = metric.colorScale[1]; // Start with first non-vacant color
                        
                        for (let i = 2; i < metric.colorScale.length; i++) {
                            if (value >= metric.colorScale[i].value) {
                                colorItem = metric.colorScale[i];
                            }
                        }
                        
                        color = colorItem.color;
                    }
                }
                
                // Apply the color with animation
                roomElement.style.transition = 'fill 0.5s';
                roomElement.setAttribute('fill', color);
            });
        },
        
        _updateSummary: function() {
            const currentBuilding = this.currentState.building;
            const currentFloor = this.currentState.floor;
            
            if (!this.buildings[currentBuilding] || 
                !this.buildings[currentBuilding].floors || 
                !this.buildings[currentBuilding].floors[currentFloor]) {
                return;
            }
            
            const floor = this.buildings[currentBuilding].floors[currentFloor];
            const rooms = floor.rooms;
            
            const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);
            const occupiedRooms = rooms.filter(room => room.occupied);
            const occupiedArea = occupiedRooms.reduce((sum, room) => sum + room.area, 0);
            const occupancyRate = (occupiedRooms.length / rooms.length) * 100;
            
            let totalRevenue = 0;
            occupiedRooms.forEach(room => {
                if (room.rent_per_sqm) {
                    totalRevenue += room.rent_per_sqm * room.area;
                }
            });
            
            const avgRentPerSqm = occupiedArea > 0 ? totalRevenue / occupiedArea : 0;
            
            this.el.querySelector('#total-area').textContent = `${totalArea.toFixed(1)} м²`;
            this.el.querySelector('#occupied-area').textContent = `${occupiedArea.toFixed(1)} м²`;
            this.el.querySelector('#occupancy-rate').textContent = `${occupancyRate.toFixed(1)}%`;
            this.el.querySelector('#monthly-revenue').textContent = this._formatCurrency(totalRevenue);
            this.el.querySelector('#avg-rent').textContent = `${this._formatCurrency(avgRentPerSqm)}/м²`;
        },
        
        _setupEventListeners: function() {
            // Room event listeners
            for (const buildingKey in this.buildings) {
                const building = this.buildings[buildingKey];
                for (const floorKey in building.floors) {
                    const floorPlanSvg = this.el.querySelector(`#floorplan-${buildingKey}${floorKey}`);
                    
                    if (floorPlanSvg) {
                        const rooms = floorPlanSvg.querySelectorAll('.room');
                        
                        rooms.forEach(room => {
                            // Click event
                            room.addEventListener('click', (e) => {
                                const roomId = e.target.getAttribute('data-room-id');
                                this._showRoomDetails(roomId);
                            });
                            
                            // Mouse enter event for tooltip
                            room.addEventListener('mouseenter', (e) => {
                                const roomId = e.target.getAttribute('data-room-id');
                                this._showTooltip(e, roomId);
                            });
                            
                            // Mouse move event for tooltip
                            room.addEventListener('mousemove', (e) => {
                                this._moveTooltip(e);
                            });
                            
                            // Mouse leave event for tooltip
                            room.addEventListener('mouseleave', () => {
                                this._hideTooltip();
                            });
                        });
                    }
                }
            }
        },
        
        _changeFloorPlan: function(building, floor) {
            // Update current state
            this.currentState.building = building;
            this.currentState.floor = floor;
            
            // Update floor title
            this.el.querySelector('#current-floor-title').textContent = 
                this.buildings[building].floors[floor].name;
            
            // Hide all floor plans
            const floorPlans = this.el.querySelectorAll('.floor-plan-svg');
            floorPlans.forEach(fp => {
                fp.classList.remove('active');
            });
            
            // Show the selected floor plan
            const selectedFloorPlan = this.el.querySelector(`#floorplan-${building}${floor}`);
            if (selectedFloorPlan) {
                selectedFloorPlan.classList.add('active');
            }
            
            // Update metrics and summary
            this._updateMetricColors(this.currentState.metric);
            this._updateSummary();
        },
        
        _showRoomDetails: function(roomId) {
            const currentBuilding = this.currentState.building;
            const currentFloor = this.currentState.floor;
            const floor = this.buildings[currentBuilding].floors[currentFloor];
            const room = floor.rooms.find(r => r.id === roomId);
            
            if (!room) return;
            
            const detailPanel = this.el.querySelector('.detail-panel');
            const tenantDetailsContainer = this.el.querySelector('#tenant-details');
            
            tenantDetailsContainer.innerHTML = '';
            
            if (room.occupied) {
                // Room is occupied, show tenant details
                const monthlyRent = room.rent_per_sqm * room.area;
                
                // Header section
                const header = document.createElement('div');
                header.className = 'tenant-header';
                
                const roomIdElement = document.createElement('div');
                roomIdElement.className = 'room-id';
                roomIdElement.textContent = `Помещение ${room.id}`;
                
                const tenantName = document.createElement('div');
                tenantName.className = 'tenant-name';
                tenantName.textContent = room.tenant_name || 'Арендатор';
                
                const businessType = document.createElement('div');
                businessType.className = 'business-type';
                businessType.textContent = room.business_type || 'Бизнес';
                
                header.appendChild(roomIdElement);
                header.appendChild(tenantName);
                header.appendChild(businessType);
                
                // Space details
                const spaceSection = document.createElement('div');
                spaceSection.className = 'detail-section';
                
                const spaceTitle = document.createElement('h4');
                spaceTitle.textContent = 'Информация о помещении';
                spaceSection.appendChild(spaceTitle);
                
                const spaceGrid = document.createElement('div');
                spaceGrid.className = 'detail-grid';
                
                // Add space details
                this._addDetailItem(spaceGrid, 'Площадь', `${room.area} м²`);
                this._addDetailItem(spaceGrid, 'Стоимость за м²', `$${room.rent_per_sqm.toFixed(2)}`);
                this._addDetailItem(spaceGrid, 'Ежемесячная аренда', this._formatCurrency(monthlyRent));
                this._addDetailItem(spaceGrid, 'Годовая аренда', this._formatCurrency(monthlyRent * 12));
                
                spaceSection.appendChild(spaceGrid);
                
                // Contract details
                const contractSection = document.createElement('div');
                contractSection.className = 'detail-section';
                
                const contractTitle = document.createElement('h4');
                contractTitle.textContent = 'Информация о контракте';
                contractSection.appendChild(contractTitle);
                
                const contractGrid = document.createElement('div');
                contractGrid.className = 'detail-grid';
                
                // Add contract details
                this._addDetailItem(contractGrid, 'Дата начала', this._formatDate(room.start_date));
                this._addDetailItem(contractGrid, 'Дата окончания', this._formatDate(room.end_date));
                this._addDetailItem(contractGrid, 'Срок контракта', `${room.contract_duration} месяцев`);
                this._addDetailItem(contractGrid, 'Депозит', this._formatCurrency(room.deposit_amount));
                
                contractSection.appendChild(contractGrid);
                
                // Contact details - in a real implementation these would come from the tenant record
                const contactSection = document.createElement('div');
                contactSection.className = 'detail-section';
                
                const contactTitle = document.createElement('h4');
                contactTitle.textContent = 'Контактная информация';
                contactSection.appendChild(contactTitle);
                
                const contactItems = document.createElement('div');
                contactItems.className = 'contact-section';
                
                // Contact person
                const contactPerson = document.createElement('div');
                contactPerson.className = 'contact-item';
                contactPerson.innerHTML = `<svg class="contact-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                contactPerson.innerHTML += `<span>Контактное лицо</span>`;
                
                // Phone
                const phone = document.createElement('div');
                phone.className = 'contact-item';
                phone.innerHTML = `<svg class="contact-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
                phone.innerHTML += `<span>+7 (XXX) XXX-XXXX</span>`;
                
                // Email
                const email = document.createElement('div');
                email.className = 'contact-item';
                email.innerHTML = `<svg class="contact-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
                email.innerHTML += `<span>info@example.com</span>`;
                
                contactItems.appendChild(contactPerson);
                contactItems.appendChild(phone);
                contactItems.appendChild(email);
                contactSection.appendChild(contactItems);
                
                // Add all sections to the container
                tenantDetailsContainer.appendChild(header);
                tenantDetailsContainer.appendChild(spaceSection);
                tenantDetailsContainer.appendChild(contractSection);
                tenantDetailsContainer.appendChild(contactSection);
                
                // Add action buttons
                const actionsSection = document.createElement('div');
                actionsSection.className = 'detail-section';
                
                const actionsTitle = document.createElement('h4');
                actionsTitle.textContent = 'Действия';
                actionsSection.appendChild(actionsTitle);
                
                const viewContractButton = document.createElement('button');
                viewContractButton.className = 'btn btn-primary mb-2 w-100';
                viewContractButton.textContent = 'Просмотр контракта';
                viewContractButton.addEventListener('click', () => {
                    // Open contract form
                    this._openRecord('office.contract', room.current_contract_id);
                });
                
                const viewTenantButton = document.createElement('button');
                viewTenantButton.className = 'btn btn-outline-primary w-100';
                viewTenantButton.textContent = 'Просмотр арендатора';
                viewTenantButton.addEventListener('click', () => {
                    // Open tenant form
                    this._openRecord('res.partner', room.tenant_id);
                });
                
                actionsSection.appendChild(viewContractButton);
                actionsSection.appendChild(viewTenantButton);
                
                tenantDetailsContainer.appendChild(actionsSection);
            } else {
                // Room is vacant
                const vacantMessage = document.createElement('div');
                vacantMessage.className = 'vacant-message';
                
                const vacantIcon = document.createElement('div');
                vacantIcon.className = 'vacant-icon';
                vacantIcon.innerHTML = '🏢';
                
                const message = document.createElement('h3');
                message.textContent = `Помещение ${room.id} свободно`;
                
                const subMessage = document.createElement('p');
                subMessage.textContent = `${room.area} м² доступно для аренды`;
                
                vacantMessage.appendChild(vacantIcon);
                vacantMessage.appendChild(message);
                vacantMessage.appendChild(subMessage);
                
                // Add create contract button
                const createContractButton = document.createElement('button');
                createContractButton.className = 'btn btn-primary mt-3';
                createContractButton.textContent = 'Создать контракт';
                createContractButton.addEventListener('click', () => {
                    // Create new contract
                    this._createContract(room.odooId);
                });
                
                vacantMessage.appendChild(createContractButton);
                
                tenantDetailsContainer.appendChild(vacantMessage);
            }
            
            // Show the panel with animation
            detailPanel.classList.add('active');
            setTimeout(() => {
                tenantDetailsContainer.classList.add('animate-in');
            }, 100);
        },
        
        _openRecord: function(model, recordId) {
            this.trigger_up('do_action', {
                action: {
                    type: 'ir.actions.act_window',
                    res_model: model,
                    res_id: recordId,
                    views: [[false, 'form']],
                    target: 'current',
                    context: {},
                }
            });
        },
        
        _createContract: function(roomId) {
            this.trigger_up('do_action', {
                action: {
                    type: 'ir.actions.act_window',
                    res_model: 'office.contract',
                    views: [[false, 'form']],
                    target: 'current',
                    context: {
                        'default_room_id': roomId
                    },
                }
            });
        },
        
        _showTooltip: function(event, roomId) {
            const currentBuilding = this.currentState.building;
            const currentFloor = this.currentState.floor;
            const floor = this.buildings[currentBuilding].floors[currentFloor];
            const room = floor.rooms.find(r => r.id === roomId);
            
            if (!room) return;
            
            const tooltip = this.el.querySelector('#tooltip');
            
            let tooltipContent = `<strong>Помещение ${room.id}</strong><br>Площадь: ${room.area} м²<br>`;
            
            if (room.occupied) {
                const monthlyRent = room.rent_per_sqm * room.area;
                tooltipContent += `Арендатор: ${room.tenant_name || 'Арендатор'}<br>`;
                tooltipContent += `Аренда: ${this._formatCurrency(monthlyRent)}/месяц<br>`;
                tooltipContent += `($${room.rent_per_sqm.toFixed(2)}/м²)`;
            } else {
                tooltipContent += `<em>Свободно</em>`;
            }
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.opacity = '1';
            
            this._moveTooltip(event);
        },
        
        _moveTooltip: function(event) {
            const tooltip = this.el.querySelector('#tooltip');
            const padding = 15;
            
            // Position the tooltip near the cursor but not directly under it
            const rect = event.target.getBoundingClientRect();
            const containerRect = this.el.querySelector('.floor-plan-container').getBoundingClientRect();
            
            const x = rect.right - containerRect.left + padding;
            const y = rect.top - containerRect.top + padding;
            
            // Check if tooltip would go off screen
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;
            
            let posX = x;
            let posY = y;
            
            if (x + tooltipWidth > containerWidth) {
                posX = x - tooltipWidth - padding * 2;
            }
            
            if (y + tooltipHeight > containerHeight) {
                posY = y - tooltipHeight - padding * 2;
            }
            
            tooltip.style.left = `${posX}px`;
            tooltip.style.top = `${posY}px`;
        },
        
        _hideTooltip: function() {
            const tooltip = this.el.querySelector('#tooltip');
            tooltip.style.opacity = '0';
        },
        
        _showLegendSummary: function(metricName, value) {
            const metric = this.metrics[metricName];
            const currentBuilding = this.currentState.building;
            const currentFloor = this.currentState.floor;
            const floor = this.buildings[currentBuilding].floors[currentFloor];
            const rooms = floor.rooms;
            
            let matchingRooms = [];
            
            if (metricName === 'businessType') {
                // For business type, exact match
                matchingRooms = rooms.filter(room => {
                    const roomValue = metric.getValueForRoom(room.id, room);
                    return roomValue === value;
                });
            } else if (metricName === 'occupancyStatus') {
                // For occupancy status
                const isOccupied = value === 1;
                matchingRooms = rooms.filter(room => room.occupied === isOccupied);
            } else {
                // For numerical metrics
                const valueIndex = metric.colorScale.findIndex(item => item.value === value);
                
                if (valueIndex === 0) {
                    // Vacant rooms
                    matchingRooms = rooms.filter(room => !room.occupied);
                } else {
                    const minValue = value;
                    const maxValue = valueIndex < metric.colorScale.length - 1 
                                    ? metric.colorScale[valueIndex + 1].value 
                                    : Infinity;
                    
                    matchingRooms = rooms.filter(room => {
                        const roomValue = metric.getValueForRoom(room.id, room);
                        return roomValue >= minValue && roomValue < maxValue;
                    });
                }
            }
            
            // Highlight matching rooms
            const svgRooms = this.el.querySelectorAll(`#floorplan-${currentBuilding}${currentFloor} .room`);
            
            svgRooms.forEach(roomElement => {
                const roomId = roomElement.getAttribute('data-room-id');
                const isMatching = matchingRooms.some(r => r.id === roomId);
                
                if (isMatching) {
                    roomElement.style.opacity = '1';
                    roomElement.setAttribute('stroke-width', '3');
                    roomElement.setAttribute('stroke', '#2563eb');
                } else {
                    roomElement.style.opacity = '0.4';
                    roomElement.setAttribute('stroke-width', '1');
                    roomElement.setAttribute('stroke', '#333');
                }
            });
            
            // Show summary for these rooms
            if (matchingRooms.length > 0) {
                const totalArea = matchingRooms.reduce((sum, room) => sum + room.area, 0);
                const occupiedRooms = matchingRooms.filter(room => room.occupied);
                const occupiedArea = occupiedRooms.reduce((sum, room) => sum + room.area, 0);
                const occupancyRate = matchingRooms.length > 0 ? (occupiedRooms.length / matchingRooms.length) * 100 : 0;
                
                let totalRevenue = 0;
                occupiedRooms.forEach(room => {
                    if (room.rent_per_sqm) {
                        totalRevenue += room.rent_per_sqm * room.area;
                    }
                });
                
                const avgRentPerSqm = occupiedArea > 0 ? totalRevenue / occupiedArea : 0;
                
                // Display the filtered summary
                this.el.querySelector('#total-area').textContent = `${totalArea.toFixed(1)} м²`;
                this.el.querySelector('#occupied-area').textContent = `${occupiedArea.toFixed(1)} м²`;
                this.el.querySelector('#occupancy-rate').textContent = `${occupancyRate.toFixed(1)}%`;
                this.el.querySelector('#monthly-revenue').textContent = this._formatCurrency(totalRevenue);
                this.el.querySelector('#avg-rent').textContent = `${this._formatCurrency(avgRentPerSqm)}/м²`;
                
                // Show dialog with info
                let title = '';
                if (metricName === 'businessType') {
                    title = `${value}`;
                } else if (metricName === 'occupancyStatus') {
                    title = value === 1 ? 'Занятые помещения' : 'Свободные помещения';
                } else {
                    const nextIndex = metric.colorScale.indexOf(metric.colorScale.find(item => item.value === value)) + 1;
                    if (nextIndex < metric.colorScale.length && value !== 0) {
                        const nextValue = metric.colorScale[nextIndex].value;
                        title = `${metric.formatValue(value)} - ${metric.formatValue(nextValue)}`;
                    } else if (value === 0) {
                        title = 'Свободные помещения';
                    } else {
                        title = `${metric.formatValue(value)}+`;
                    }
                }
                
                // Use Odoo's dialog system instead of alert
                this._showDialog(title, {
                    rooms: matchingRooms.map(r => r.id).join(', '),
                    totalArea: totalArea.toFixed(1),
                    occupancyRate: occupancyRate.toFixed(1),
                    revenue: this._formatCurrency(totalRevenue)
                });
            }
            
            // Add a timeout to reset highlighting
            setTimeout(() => {
                svgRooms.forEach(roomElement => {
                    roomElement.style.opacity = '1';
                    roomElement.setAttribute('stroke-width', '1');
                    roomElement.setAttribute('stroke', '#333');
                });
                
                this._updateSummary(); // Reset to overall summary
            }, 5000);
        },
        
        _showDialog: function(title, data) {
            this.trigger_up('show_effect', {
                message: _t(`${title}

Помещения: ${data.rooms}
Общая площадь: ${data.totalArea} м²
Занятость: ${data.occupancyRate}%
Ежемесячный доход: ${data.revenue}`),
                type: 'rainbow_man',
            });
        },
        
        _formatCurrency: function(amount) {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(amount);
        },
        
        _formatDate: function(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        },
        
        _addDetailItem: function(container, label, value) {
            const item = document.createElement('div');
            item.className = 'detail-item';
            
            const labelElement = document.createElement('div');
            labelElement.className = 'detail-label';
            labelElement.textContent = label;
            
            const valueElement = document.createElement('div');
            valueElement.className = 'detail-value';
            valueElement.textContent = value;
            
            item.appendChild(labelElement);
            item.appendChild(valueElement);
            container.appendChild(item);
        },
        
        // Event Handlers
        _onBuildingTabClick: function(event) {
            const building = event.currentTarget.getAttribute('data-building');
            
            // Update UI
            this.el.querySelectorAll('.building-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.currentTarget.classList.add('active');
            
            // Change floor plan
            this._changeFloorPlan(building, this.currentState.floor);
        },
        
        _onFloorTabClick: function(event) {
            const floor = event.currentTarget.getAttribute('data-floor');
            
            // Update UI
            this.el.querySelectorAll('.floor-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.currentTarget.classList.add('active');
            
            // Change floor plan
            this._changeFloorPlan(this.currentState.building, floor);
        },
        
        _onMetricButtonClick: function(event) {
            const metricName = event.currentTarget.getAttribute('data-metric');
            
            // Update UI
            this.el.querySelectorAll('.metric-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.currentTarget.classList.add('active');
            
            // Update current state
            this.currentState.metric = metricName;
            
            // Update colors and legend
            this._updateMetricColors(metricName);
            this._updateLegend(metricName);
        },
        
        _onCloseDetailsClick: function() {
            const detailPanel = this.el.querySelector('.detail-panel');
            const tenantDetailsContainer = this.el.querySelector('#tenant-details');
            
            tenantDetailsContainer.classList.remove('animate-in');
            detailPanel.classList.remove('active');
        }
    });
    
    registry.add('floor_plan_widget', FloorPlanWidget);
    
    return FloorPlanWidget;
});