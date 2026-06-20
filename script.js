document.addEventListener('DOMContentLoaded', async () => {
    // Quickform API 配置
    const DEFAULT_API_URL = 'https://quickform.cn/api/s0bqsjoeon';
    let QUICKFORM_API_URL = localStorage.getItem('classpet_api_url') || DEFAULT_API_URL;

    // 管理员密码 SHA-256 哈希（明文不在源码中暴露）
    const PASSWORD_HASH = '6ebce73fbbfa653e3a017cf0b6577d1b9ec7e86cd3b6632d4fba1522dc3e898d';
    

    // HTML 转义，防止 XSS
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 宠物图像映射及动态数据
    let availablePets = [];
    
    // 获取本地宠物数据
    async function loadPetsData() {
        try {
            // 直接使用 index.html 中通过 script 标签引入的 LOCAL_PETS_DATA 变量
            if (typeof LOCAL_PETS_DATA !== 'undefined' && LOCAL_PETS_DATA.pets) {
                availablePets = LOCAL_PETS_DATA.pets;
                console.log('成功加载本地数据变量', availablePets.length, '个宠物');
            } else {
                console.warn('LOCAL_PETS_DATA 变量未定义，请检查 index.html 中是否引入了 pets-data-local.js');
            }
        } catch (error) {
            console.error("加载本地宠物数据失败:", error);
        }
    }

    const getPetImage = (type, level = 1) => {
        if (!type || availablePets.length === 0) return ''; // 无数据时返回空字符串
        
        let petInfo = availablePets.find(p => p.name === type);
        if (!petInfo) {
            // 如果没找到，默认取第一个宠物
            petInfo = availablePets[0];
        }
        
        if (petInfo && petInfo.stages && petInfo.stages.length > 0) {
            // 等级对应图片索引 (level 1 -> index 0)
            const stageIndex = Math.min(Math.max(0, level - 1), petInfo.stages.length - 1);
            // 找到对应阶段的图片，如果没有则返回第一阶段图片，如果也没有返回空
            const imagePath = petInfo.stages[stageIndex] || petInfo.stages[0] || '';
            return imagePath;
        }
        
        return '';
    };

    // 从 localStorage 获取数据，如果没有则使用空数组
    let students = JSON.parse(localStorage.getItem('classPetsStudents'));
    if (!students || !Array.isArray(students)) {
        students = [];
        saveStudents();
    }

    function saveStudents() {
        localStorage.setItem('classPetsStudents', JSON.stringify(students));
    }

    const grid = document.getElementById('studentGrid');
    
    // 奖励模态框相关 DOM (已被学生档案模态框替代，部分变量保留给打分表单)
    const recordForm = document.getElementById('recordForm');
    const studentNameInput = document.getElementById('studentNameInput');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');

    // 设置/批量导入模态框相关 DOM
    const settingsBtn = document.getElementById('settingsBtn');
    const setupModal = document.getElementById('setupModal');
    const closeSetupModalBtn = document.getElementById('closeSetupModalBtn');
    const apiUrlInput = document.getElementById('apiUrlInput');
    const bulkInput = document.getElementById('bulkInput');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const addStudentsBtn = document.getElementById('addStudentsBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const apiStatusMessage = document.getElementById('apiStatusMessage');
    const addStatusMessage = document.getElementById('addStatusMessage');
    const shopBtn = document.getElementById('shopBtn');
    const shopModal = document.getElementById('shopModal');
    const closeShopModalBtn = document.getElementById('closeShopModalBtn');
    const shopForm = document.getElementById('shopForm');
    const shopSubmitBtn = document.getElementById('shopSubmitBtn');
    const shopStatusMessage = document.getElementById('shopStatusMessage');

    const changePetModal = document.getElementById('changePetModal');
    const closeChangePetModalBtn = document.getElementById('closeChangePetModalBtn');
    const changePetForm = document.getElementById('changePetForm');
    const petTypeSelect = document.getElementById('petTypeSelect');
    const changePetStudentInput = document.getElementById('changePetStudentInput');
    const changePetStudentName = document.getElementById('changePetStudentName');
    const changePetSubmitBtn = document.getElementById('changePetSubmitBtn');
    const changePetStatusMessage = document.getElementById('changePetStatusMessage');

    const rankingBtn = document.getElementById('rankingBtn');
    const rankingModal = document.getElementById('rankingModal');
    const closeRankingModalBtn = document.getElementById('closeRankingModalBtn');
    const rankingList = document.getElementById('rankingList');

    const searchInput = document.getElementById('searchInput');

    const batchBtn = document.getElementById('batchBtn');
    const batchActions = document.getElementById('batchActions');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const batchScoreBtn = document.getElementById('batchScoreBtn');
    const cancelBatchBtn = document.getElementById('cancelBatchBtn');

    const undoBtn = document.getElementById('undoBtn');

    // 当前的搜索关键字
    let currentSearchQuery = '';
    
    // 批量模式状态
    let isBatchMode = false;
    let selectedStudents = new Set();

    // 记录最近一次的积分操作，用于撤回
    // 结构：{ isBatch: boolean, records: [{name: '张三', score: 2}, ...] }
    let lastAction = null;

    // 防抖工具函数
    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            currentSearchQuery = e.target.value;
            renderCards();
        }, 200));
    }

    // 批量模式切换
    if (batchBtn) {
        batchBtn.onclick = () => {
            isBatchMode = true;
            selectedStudents.clear();
            batchActions.style.display = 'flex';
            batchBtn.style.display = 'none';
            renderCards();
        };
    }

    if (cancelBatchBtn) {
        cancelBatchBtn.onclick = () => {
            isBatchMode = false;
            selectedStudents.clear();
            batchActions.style.display = 'none';
            batchBtn.style.display = 'inline-block';
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            renderCards();
        };
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = (e) => {
            const isChecked = e.target.checked;
            const filteredStudents = students.filter(student => 
                student.name.toLowerCase().includes(currentSearchQuery.toLowerCase())
            );
            
            if (isChecked) {
                filteredStudents.forEach(s => selectedStudents.add(s.name));
            } else {
                filteredStudents.forEach(s => selectedStudents.delete(s.name));
            }
            renderCards();
        };
    }

    if (batchScoreBtn) {
        batchScoreBtn.onclick = () => {
            if (selectedStudents.size === 0) {
                alert('请先选择学生！');
                return;
            }
            const batchName = Array.from(selectedStudents).join(', ');
            openStudentProfileModal({
                name: batchName,
                petType: '批量',
                level: '-',
                currentExp: 0,
                maxExp: 1,
                medals: '-',
                redemptionHistory: []
            });
        };
    }

    // 显示状态消息的工具函数
    function showStatusMessage(element, message, type) {
        element.textContent = message;
        element.className = `status-message ${type}`;
        element.style.display = 'block';
    }
    function playScoreAnimation(studentName, score) {
        // 在网格中找到对应的学生卡片
        const cards = document.querySelectorAll('.student-card');
        let targetCard = null;
        for (const card of cards) {
            const nameEl = card.querySelector('.student-name');
            if (nameEl && nameEl.textContent === studentName) {
                targetCard = card;
                break;
            }
        }
        
        if (targetCard) {
            const animEl = document.createElement('div');
            animEl.className = `score-animation ${score > 0 ? 'positive' : 'negative'}`;
            animEl.textContent = score > 0 ? `+${score}` : `${score}`;
            targetCard.appendChild(animEl);
            
            // 动画结束后移除元素
            setTimeout(() => {
                if (animEl.parentNode === targetCard) {
                    targetCard.removeChild(animEl);
                }
            }, 1000);
        }
    }

    // 计算等级和经验的工具函数
    function calculateLevelInfo(totalExp) {
        if (totalExp < 0) totalExp = 0;
        let level = 1;
        let currentExp = totalExp;
        let maxExp = 5;
        
        while (currentExp >= maxExp) {
            currentExp -= maxExp;
            level++;
            maxExp = level * 5;
        }
        
        return { level, currentExp, maxExp };
    }

    // 渲染卡片
    function renderCards() {
        grid.innerHTML = '';
        if (students.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: #999;">还没有学生数据，请点击右上角“设置”进行批量录入。</div>';
            return;
        }
        
        // 过滤学生列表
        let filteredStudents = students.filter(student => 
            student.name.toLowerCase().includes(currentSearchQuery.toLowerCase())
        );

        // 按照姓名拼音排序
        filteredStudents.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

        filteredStudents.forEach(student => {
            const percent = (student.currentExp / student.maxExp) * 100;
            
            const card = document.createElement('div');
            card.className = 'student-card';
            if (isBatchMode && selectedStudents.has(student.name)) {
                card.classList.add('selected');
            }
            
            card.onclick = () => {
                if (isBatchMode) {
                    const cb = card.querySelector('.student-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        if (cb.checked) {
                            selectedStudents.add(student.name);
                            card.classList.add('selected');
                        } else {
                            selectedStudents.delete(student.name);
                            card.classList.remove('selected');
                        }
                    }
                } else {
                    openStudentProfileModal(student);
                }
            };
            
            // 批量模式下的复选框
            let checkboxHtml = '';
            if (isBatchMode) {
                checkboxHtml = `<input type="checkbox" class="student-checkbox" value="${escapeHtml(student.name)}" ${selectedStudents.has(student.name) ? 'checked' : ''} style="position: absolute; top: 15px; left: 15px; transform: scale(1.5); cursor: pointer; z-index: 20;" onclick="event.stopPropagation(); if(this.checked) { selectedStudents.add('${escapeHtml(student.name)}'); this.closest('.student-card').classList.add('selected'); } else { selectedStudents.delete('${escapeHtml(student.name)}'); this.closest('.student-card').classList.remove('selected'); }">`;
            }

            card.innerHTML = `
                ${checkboxHtml}
                <div class="card-header">
                    <button class="change-pet-btn" onclick="event.stopPropagation(); openChangePetModal(${student.id})" title="换宠" ${isBatchMode ? 'style="display: none;"' : ''}>
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <div class="level-indicator">
                        <i class="fas fa-crown level-icon"></i> LV. ${student.level}
                    </div>
                </div>
                <div class="pet-image-container">
                    <img src="${getPetImage(student.petType, student.level)}" class="pet-image" alt="${escapeHtml(student.petType)}">
                </div>
                <div class="pet-type">${escapeHtml(student.petType)}</div>
                <div class="student-name">${escapeHtml(student.name)}</div>
                <div class="progress-wrapper">
                    <div class="progress-info">
                        <div class="progress-label">
                            <span>本级进度</span>
                        </div>
                        <span class="need-exp">${student.currentExp} / ${student.maxExp}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="total-exp">总积分: ${student.totalExp}</div>
                    <div class="medals">🏅 ${student.medals}</div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // ---- 奖励与学生档案功能逻辑 ----
    const studentProfileModal = document.getElementById('studentProfileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    const profileStudentNameTitle = document.getElementById('profileStudentNameTitle');
    const profilePetImage = document.getElementById('profilePetImage');
    const profileStudentName = document.getElementById('profileStudentName');
    const profileLevel = document.getElementById('profileLevel');
    const profilePetType = document.getElementById('profilePetType');
    const profileExpText = document.getElementById('profileExpText');
    const profileExpBar = document.getElementById('profileExpBar');
    const profileExpHint = document.getElementById('profileExpHint');
    const profileMedalsCount = document.getElementById('profileMedalsCount');
    const tabScoreBtn = document.getElementById('tabScoreBtn');
    const tabHistoryBtn = document.getElementById('tabHistoryBtn');
    const tabScoreContent = document.getElementById('tabScoreContent');
    const tabHistoryContent = document.getElementById('tabHistoryContent');
    const redemptionHistoryList = document.getElementById('redemptionHistoryList');

    function openStudentProfileModal(student) {
        studentNameInput.value = student.name;
        
        // 填充左侧信息
        profileStudentNameTitle.textContent = student.name;
        profileStudentName.textContent = student.name;
        profilePetImage.src = getPetImage(student.petType, student.level === '-' ? 1 : student.level);
        profileLevel.textContent = student.level === '-' ? '批量操作' : `Lv.${student.level}`;
        profilePetType.textContent = student.petType;
        
        if (student.level === '-') {
            profileExpText.textContent = `- / -`;
            profileExpBar.style.width = `0%`;
            profileExpHint.textContent = `批量操作时不显示经验值`;
            profileMedalsCount.textContent = '-';
            redemptionHistoryList.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">批量操作无兑换记录</div>';
        } else {
            profileExpText.textContent = `${student.currentExp} / ${student.maxExp}`;
            const percent = (student.currentExp / student.maxExp) * 100;
            profileExpBar.style.width = `${percent}%`;
            profileExpHint.textContent = `升级到下一级，还需 ${student.maxExp - student.currentExp} 经验`;
            profileMedalsCount.textContent = student.medals || 0;

            // 填充历史记录
            redemptionHistoryList.innerHTML = '';
            if (student.redemptionHistory && student.redemptionHistory.length > 0) {
                // 按时间倒序
                const sortedHistory = [...student.redemptionHistory].sort((a, b) => new Date(b.time) - new Date(a.time));
                sortedHistory.forEach(record => {
                    const dateObj = new Date(record.time);
                    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                    
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    
                    if (record.type === 'shop' || record.item) {
                        // 兑换记录
                        item.innerHTML = `
                            <div class="history-item-info">
                                <span class="history-item-name" style="color: #f39c12;"><i class="fas fa-store"></i> 兑换: ${escapeHtml(record.item)}</span>
                                <span class="history-item-time">${dateStr}</span>
                            </div>
                            <div class="history-item-cost" style="color: #e74c3c;">- ${record.cost} 勋章</div>
                        `;
                    } else if (record.type === 'score' || record.score) {
                        // 打分记录
                        const isPositive = record.score > 0;
                        const scoreColor = isPositive ? '#2ecc71' : '#e74c3c';
                        const scoreSign = isPositive ? '+' : '';
                        item.innerHTML = `
                            <div class="history-item-info">
                                <span class="history-item-name" style="color: #3498db;"><i class="fas fa-star"></i> 课堂表现</span>
                                <span class="history-item-time">${dateStr}</span>
                            </div>
                            <div class="history-item-cost" style="color: ${scoreColor}; font-weight: bold;">${scoreSign}${record.score} 积分</div>
                        `;
                    }
                    
                    redemptionHistoryList.appendChild(item);
                });
            } else {
                redemptionHistoryList.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">暂无历史记录</div>';
            }
        }

        // 重置表单和状态
        statusMessage.style.display = 'none';
        recordForm.reset();
        
        // 默认显示打分Tab
        switchTab('score');

        studentProfileModal.classList.add('active');
    }

    function switchTab(tab) {
        if (tab === 'score') {
            tabScoreBtn.classList.add('active');
            tabHistoryBtn.classList.remove('active');
            tabScoreContent.classList.add('active');
            tabHistoryContent.classList.remove('active');
        } else {
            tabHistoryBtn.classList.add('active');
            tabScoreBtn.classList.remove('active');
            tabHistoryContent.classList.add('active');
            tabScoreContent.classList.remove('active');
        }
    }

    tabScoreBtn.onclick = () => switchTab('score');
    tabHistoryBtn.onclick = () => switchTab('history');

    closeProfileModalBtn.onclick = () => studentProfileModal.classList.remove('active');

    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(recordForm);
        const studentNameStr = formData.get('name');
        const score = Number(formData.get('score'));
        const isBatch = studentNameStr.includes(',');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在提交...';
        statusMessage.className = 'status-message';
        statusMessage.style.display = 'none';

        try {
            const namesToProcess = isBatch ? studentNameStr.split(',').map(n => n.trim()) : [studentNameStr];
            
            const promises = namesToProcess.map(name => {
                const student = students.find(s => s.name === name);
                const petType = student ? student.petType : '猫';
                const data = {
                    name: name,
                    score: score,
                    petType: petType,
                    type: 'reward'
                };
                return fetch(QUICKFORM_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            });

            const responses = await Promise.all(promises);
            const allOk = responses.every(r => r.ok || r.status === 200);

            if (allOk) {
                showStatusMessage(statusMessage, '🎉 积分提交成功！', 'success');
                
                // 记录操作以便撤回
                lastAction = {
                    isBatch: isBatch,
                    records: namesToProcess.map(name => ({ name: name, score: score }))
                };

                // 为了保证数据100%准确，提交后直接重新拉取服务器数据进行全局同步
                await initData(); 
                
                // 播放积分动画
                namesToProcess.forEach(name => {
                    playScoreAnimation(name, score);
                });

                setTimeout(() => {
                    studentProfileModal.classList.remove('active');
                    if (isBatch && cancelBatchBtn) {
                        cancelBatchBtn.click();
                    }
                }, 1000);
            } else {
                throw new Error('部分或全部网络或接口异常');
            }
        } catch (error) {
            showStatusMessage(statusMessage, `❌ 提交失败：${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 提交';
        }
    });

    // ---- 撤回功能逻辑 ----
    if (undoBtn) {
        undoBtn.onclick = async () => {
            if (!lastAction || !lastAction.records || lastAction.records.length === 0) {
                alert('没有可撤回的操作');
                return;
            }

            if (!confirm(`确定要撤回刚刚对 ${lastAction.records.map(r => r.name).join(', ')} 的评分操作吗？`)) {
                return;
            }

            undoBtn.disabled = true;
            undoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 撤回中...';

            try {
                // 构建反向操作：把原来的分数取反
                const promises = lastAction.records.map(record => {
                    const student = students.find(s => s.name === record.name);
                    const petType = student ? student.petType : '猫';
                    const reversedScore = -record.score; // 取反
                    
                    const data = {
                        name: record.name,
                        score: reversedScore,
                        petType: petType,
                        type: 'reward' // 撤回也是作为一条记录提交
                    };
                    
                    return fetch(QUICKFORM_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                });

                const responses = await Promise.all(promises);
                const allOk = responses.every(r => r.ok || r.status === 200);

                if (allOk) {
                    alert('撤回成功！');
                    
                    // 播放撤回的积分动画（相反的分数）
                    lastAction.records.forEach(record => {
                        playScoreAnimation(record.name, -record.score);
                    });
                    
                    // 清空最近操作，避免连续撤回导致混乱
                    lastAction = null;
                    
                    await initData(); // 重新拉取数据同步
                } else {
                    throw new Error('部分或全部撤回请求失败');
                }
            } catch (error) {
                console.error('撤回失败:', error);
                alert(`撤回失败: ${error.message}`);
            } finally {
                undoBtn.disabled = false;
                undoBtn.innerHTML = '<i class="fas fa-undo"></i> 撤回';
            }
        };
    }

    // ---- 设置/批量导入功能逻辑 ----
    const deleteStudentSelect = document.getElementById('deleteStudentSelect');
    const deleteStudentSetupBtn = document.getElementById('deleteStudentSetupBtn');
    const deleteStatusMessage = document.getElementById('deleteStatusMessage');

    settingsBtn.onclick = async () => {
        const pwd = prompt('请输入管理员密码：');
        if (pwd === null) return;

        const encoder = new TextEncoder();
        const data = encoder.encode(pwd);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === PASSWORD_HASH) {
            // 预填当前数据以便编辑
            apiUrlInput.value = QUICKFORM_API_URL;
            // 清空名单输入框，不再预填现有学生数据
            bulkInput.value = '';

            // 填充删除学生下拉列表
            if (deleteStudentSelect) {
                deleteStudentSelect.innerHTML = '<option value="">-- 请选择学生 --</option>';
                const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
                sortedStudents.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.name;
                    option.textContent = s.name;
                    deleteStudentSelect.appendChild(option);
                });
            }
            if (deleteStatusMessage) deleteStatusMessage.style.display = 'none';
            if (apiStatusMessage) apiStatusMessage.style.display = 'none';
            if (addStatusMessage) addStatusMessage.style.display = 'none';

            setupModal.classList.add('active');
        } else {
            alert('密码错误！');
        }
    };

    closeSetupModalBtn.onclick = () => setupModal.classList.remove('active');

    // 设置中的删除学生按钮
    if (deleteStudentSetupBtn) {
        deleteStudentSetupBtn.onclick = async () => {
            const name = deleteStudentSelect.value;
            if (!name) {
                alert('请先选择一个学生');
                return;
            }
            if (!confirm(`确定要删除学生 "${name}" 吗？\n该学生将从列表中隐藏。重新导入同名学生即可恢复数据。`)) {
                return;
            }

            deleteStudentSetupBtn.disabled = true;
            deleteStudentSetupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';

            const data = {
                name: name,
                score: 0,
                type: 'delete_student'
            };

            try {
                const response = await fetch(QUICKFORM_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok || response.status === 200) {
                    showStatusMessage(deleteStatusMessage, `学生 "${name}" 已删除`, 'success');
                    await initData();
                    // 刷新下拉列表
                    if (deleteStudentSelect) {
                        deleteStudentSelect.innerHTML = '<option value="">-- 请选择学生 --</option>';
                        const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
                        sortedStudents.forEach(s => {
                            const option = document.createElement('option');
                            option.value = s.name;
                            option.textContent = s.name;
                            deleteStudentSelect.appendChild(option);
                        });
                    }
                } else {
                    throw new Error('网络异常');
                }
            } catch (error) {
                showStatusMessage(deleteStatusMessage, `删除失败：${error.message}`, 'error');
            } finally {
                deleteStudentSetupBtn.disabled = false;
                deleteStudentSetupBtn.innerHTML = '<i class="fas fa-trash-alt"></i> 删除';
            }
        };
    }

    // 保存 API 地址
    if (saveApiBtn) {
        saveApiBtn.onclick = async () => {
            const userApiUrl = apiUrlInput.value.trim();
            if (!userApiUrl) {
                showStatusMessage(apiStatusMessage, '请输入接口地址', 'error');
                return;
            }
            saveApiBtn.disabled = true;
            saveApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            QUICKFORM_API_URL = userApiUrl;
            localStorage.setItem('classpet_api_url', QUICKFORM_API_URL);

            try {
                await initData();
                showStatusMessage(apiStatusMessage, '接口地址已保存，数据已刷新', 'success');
            } catch (error) {
                showStatusMessage(apiStatusMessage, '保存成功，但数据刷新失败', 'error');
            } finally {
                saveApiBtn.disabled = false;
                saveApiBtn.innerHTML = '<i class="fas fa-save"></i> 保存';
            }
        };
    }

    // 添加学生
    if (addStudentsBtn) {
        addStudentsBtn.onclick = async () => {
            const lines = bulkInput.value.trim() === '' ? [] : bulkInput.value.split('\n');
            if (lines.length === 0) {
                showStatusMessage(addStatusMessage, '请在文本框中输入学生名单', 'error');
                return;
            }

            addStudentsBtn.disabled = true;
            addStudentsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在添加...';
            if (addStatusMessage) addStatusMessage.style.display = 'none';

            const newStudents = [];
            const initPromises = [];

            lines.forEach((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return;

                const parts = trimmed.split(/[\s,，]+/);
                const name = parts[0];
                let petType = parts[1] || (availablePets.length > 0 ? availablePets[0].name : '凤凰');

                if (!availablePets.some(p => p.name === petType)) {
                    petType = availablePets.length > 0 ? availablePets[0].name : '凤凰';
                }

                const existing = students.find(s => s.name === name);
                const finalPetType = petType;

                const initData = {
                    name: name,
                    score: 0,
                    petType: finalPetType,
                    baseLevel: 1,
                    type: 'config_update'
                };

                initPromises.push(
                    fetch(QUICKFORM_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(initData)
                    })
                );

                if (!existing) {
                    newStudents.push({
                        id: Date.now() + index,
                        name: name,
                        petType: finalPetType,
                        level: 1,
                        currentExp: 0,
                        maxExp: 5,
                        totalExp: 0,
                        medals: 0,
                        redemptionHistory: [],
                        img: getPetImage(finalPetType, 1)
                    });
                } else {
                    existing.petType = finalPetType;
                    existing.img = getPetImage(finalPetType, existing.level);
                    newStudents.push(existing);
                }
            });

            try {
                await Promise.all(initPromises);
                await initData();
                showStatusMessage(addStatusMessage, `已添加 ${lines.filter(l => l.trim()).length} 名学生`, 'success');
                bulkInput.value = '';
            } catch (error) {
                console.error('添加学生失败', error);
                students = newStudents;
                saveStudents();
                renderCards();
                showStatusMessage(addStatusMessage, '部分添加失败，已更新本地数据', 'error');
            } finally {
                addStudentsBtn.disabled = false;
                addStudentsBtn.innerHTML = '<i class="fas fa-plus"></i> 添加学生';
            }
        };
    }

    // 清空输入框
    clearDataBtn.onclick = () => {
        bulkInput.value = '';
        if (addStatusMessage) addStatusMessage.style.display = 'none';
    };

    // 小卖部功能
    shopBtn.onclick = () => {
        // 动态生成学生按钮网格
        const shopStudentGrid = document.getElementById('shopStudentGrid');
        shopStudentGrid.innerHTML = '';
        
        // 按照姓名拼音排序，与主页面保持一致
        const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        
        sortedStudents.forEach(student => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shop-student-btn';
            btn.innerHTML = `
                <div class="shop-student-name">${escapeHtml(student.name)}</div>
                <div class="shop-student-score">🏅 勋章: ${student.medals}</div>
            `;
            btn.onclick = () => {
                document.querySelectorAll('.shop-student-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('shopSelectedStudentInput').value = student.name;
            };
            shopStudentGrid.appendChild(btn);
        });
        
        // 重置隐藏的输入框
        document.getElementById('shopSelectedStudentInput').value = '';
        shopStatusMessage.style.display = 'none';
        shopModal.classList.add('active');
    };

    closeShopModalBtn.onclick = () => shopModal.classList.remove('active');

    shopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentName = document.getElementById('shopSelectedStudentInput').value;
        if (!studentName) {
            alert('请先选择一个学生');
            return;
        }

        const formData = new FormData(shopForm);
        const shopItemValue = formData.get('shopItem');
        if (!shopItemValue) return;

        const [costStr, itemName] = shopItemValue.split(',');
        const cost = parseInt(costStr, 10);
        
        const student = students.find(s => s.name === studentName);
        if (!student) return;

        if (student.medals < cost) {
            showStatusMessage(shopStatusMessage, `❌ 兑换失败：${student.name} 的勋章不足！(需要 ${cost} 枚，当前 ${student.medals} 枚)`, 'error');
            return;
        }

        shopSubmitBtn.disabled = true;
        shopSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在兑换...';
        shopStatusMessage.style.display = 'none';

        // 提交扣除勋章数据
        const data = {
            name: studentName,
            score: 0, // 勋章兑换不扣除积分，积分只增不减
            medalCost: cost, // 记录花费的勋章
            petType: student.petType,
            type: 'shop_consume_medal',
            item: itemName
        };

        try {
            const response = await fetch(QUICKFORM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok || response.status === 200) {
                showStatusMessage(shopStatusMessage, `🎉 兑换成功！获得了 ${itemName}`, 'success');
                
                await initData(); // 重新拉取同步数据

                setTimeout(() => {
                    shopModal.classList.remove('active');
                }, 1500);
            } else {
                throw new Error('网络异常');
            }
        } catch (error) {
            showStatusMessage(shopStatusMessage, `❌ 失败：${error.message}`, 'error');
        } finally {
            shopSubmitBtn.disabled = false;
            shopSubmitBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> 确认兑换';
        }
    });

    // 换宠功能
    window.openChangePetModal = (studentId) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;
        
        changePetStudentInput.value = student.name;
        changePetStudentName.innerHTML = `<i class="fas fa-sync-alt"></i> 为 ${escapeHtml(student.name)} 换养宠物`;
        
        const petCategoryTabs = document.getElementById('petCategoryTabs');
        const petSelectionGrid = document.getElementById('petSelectionGrid');
        const petTypeSelect = document.getElementById('petTypeSelect');
        
        // 按照分类整理宠物
        const categories = {};
        availablePets.forEach(pet => {
            const cat = pet.category || '其它';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(pet);
        });

        // 分类图标映射
        const categoryIcons = {
            '国风神兽': '🐉',
            '绿野部落': '🌳',
            '萌犬天团': '🐶',
            '软萌喵星': '🐱',
            '山海灵宠': '⛰️',
            '生肖萌宝': '🐭',
            '水中伙伴': '🐟',
            '其它': '✨'
        };

        // 预设默认选中的宠物
        let selectedPetType = student.petType;
        petTypeSelect.value = selectedPetType;

        // 渲染分类标签和卡片
        const renderCategory = (categoryName) => {
            petSelectionGrid.innerHTML = '';
            const petsInCategory = categories[categoryName] || [];
            
            petsInCategory.forEach(pet => {
                const card = document.createElement('div');
                card.className = `pet-selection-card ${pet.name === selectedPetType ? 'selected' : ''}`;
                card.innerHTML = `
                    <img src="${getPetImage(pet.name, 1)}" alt="${escapeHtml(pet.name)}">
                    <div class="pet-selection-name">${escapeHtml(pet.name)}</div>
                `;
                
                card.onclick = () => {
                    // 移除其他卡片的选中状态
                    document.querySelectorAll('.pet-selection-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedPetType = pet.name;
                    petTypeSelect.value = pet.name;
                };
                
                petSelectionGrid.appendChild(card);
            });
        };

        // 渲染分类标签
        petCategoryTabs.innerHTML = '';
        const categoryNames = Object.keys(categories);
        
        // 找到当前宠物所在的分类，默认选中该分类
        let defaultCategory = categoryNames[0];
        for (const [cat, pets] of Object.entries(categories)) {
            if (pets.some(p => p.name === selectedPetType)) {
                defaultCategory = cat;
                break;
            }
        }

        categoryNames.forEach(cat => {
            const tab = document.createElement('div');
            tab.className = `pet-category-tab ${cat === defaultCategory ? 'active' : ''}`;
            const icon = categoryIcons[cat] || categoryIcons['其它'];
            const count = categories[cat].length;
            tab.innerHTML = `<span>${icon}</span> ${escapeHtml(cat)} <span style="color: #94a3b8; font-size: 12px;">(${count})</span>`;
            
            tab.onclick = () => {
                document.querySelectorAll('.pet-category-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderCategory(cat);
            };
            
            petCategoryTabs.appendChild(tab);
        });

        // 初始渲染默认分类的宠物
        if (categoryNames.length > 0) {
            renderCategory(defaultCategory);
        }
        
        changePetStatusMessage.style.display = 'none';
        changePetModal.classList.add('active');
    };

    closeChangePetModalBtn.onclick = () => changePetModal.classList.remove('active');

    changePetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentName = changePetStudentInput.value;
        const newPetType = petTypeSelect.value;
        
        const student = students.find(s => s.name === studentName);
        if (!student) return;

        changePetSubmitBtn.disabled = true;
        changePetSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在提交...';
        changePetStatusMessage.style.display = 'none';

        // 提交配置更新
        const initDataReq = {
            name: studentName,
            score: 0, // 换宠不加分也不扣分
            petType: newPetType,
            baseLevel: student.level, // 保持当前等级作为基础等级
            type: 'config_update'
        };

        try {
            const response = await fetch(QUICKFORM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initDataReq)
            });

            if (response.ok || response.status === 200) {
                showStatusMessage(changePetStatusMessage, '🎉 换宠成功！', 'success');
                
                await initData();

                setTimeout(() => {
                    changePetModal.classList.remove('active');
                }, 1000);
            } else {
                throw new Error('网络异常');
            }
        } catch (error) {
            showStatusMessage(changePetStatusMessage, `❌ 失败：${error.message}`, 'error');
        } finally {
            changePetSubmitBtn.disabled = false;
            changePetSubmitBtn.innerHTML = '<i class="fas fa-check"></i> 确认更换';
        }
    });

    // 光荣榜功能
    rankingBtn.onclick = () => {
        rankingList.innerHTML = '';
        if (students.length === 0) {
            rankingList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无数据</div>';
        } else {
            // 按总积分降序排序，取前5名
            const topStudents = [...students].sort((a, b) => b.totalExp - a.totalExp).slice(0, 5);
            
            topStudents.forEach((student, index) => {
                let medalHtml = '';
                if (index === 0) medalHtml = '<span style="font-size: 20px;">🥇</span>';
                else if (index === 1) medalHtml = '<span style="font-size: 20px;">🥈</span>';
                else if (index === 2) medalHtml = '<span style="font-size: 20px;">🥉</span>';
                else medalHtml = `<span style="width: 24px; display: inline-block; text-align: center; font-weight: bold; color: #7f8c8d;">${index + 1}</span>`;

                const item = document.createElement('div');
                item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: #f8f9fa; padding: 12px 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${medalHtml}
                        <img src="${getPetImage(student.petType, student.level)}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 50%; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <span style="font-size: 16px; font-weight: bold; color: #2c3e50;">${escapeHtml(student.name)}</span>
                        <span style="font-size: 12px; background: #e74c3c; color: white; padding: 2px 6px; border-radius: 10px; font-weight: bold;">Lv.${student.level}</span>
                    </div>
                    <div style="font-size: 16px; font-weight: bold; color: #8172d5;">
                        ${student.totalExp} 分
                    </div>
                `;
                rankingList.appendChild(item);
            });
        }
        rankingModal.classList.add('active');
    };

    closeRankingModalBtn.onclick = () => rankingModal.classList.remove('active');

    // 点击模态框外部背景关闭模态框
    window.onclick = (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    };

    // 离线缓存
    const CACHE_KEY = 'classPetsStudents_cache';
    const offlineBanner = document.getElementById('offlineBanner');

    function showOfflineBanner(show) {
        if (offlineBanner) {
            offlineBanner.style.display = show ? 'block' : 'none';
        }
    }

    function saveCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (e) { /* localStorage 满则静默失败 */ }
    }

    function loadCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    // 初始化渲染和数据同步
    async function initData() {
        try {
            const response = await fetch(`${QUICKFORM_API_URL}/all`);
            if (response.ok || response.status === 200) {
                const result = await response.json();
                if (result.submissions && result.submissions.length > 0) {

                    const serverStudents = {};

                    const sortedSubmissions = result.submissions.slice().reverse();

                    sortedSubmissions.forEach(sub => {
                        const name = sub.name;
                        if (!name) return;

                        // 确保宠物类型有效，否则默认第一个
                        let safePetType = availablePets.length > 0 ? availablePets[0].name : '凤凰';
                        if (availablePets.some(p => p.name === sub.petType)) {
                            safePetType = sub.petType;
                        }

                        // 初始化学生条目
                        if (!serverStudents[name]) {
                            serverStudents[name] = {
                                name: name,
                                petType: safePetType,
                                totalExp: 0,
                                maxExpEver: 0,
                                spentMedals: 0,
                                redemptionHistory: [],
                                deleted: false
                            };
                        }

                        // 处理删除学生事件
                        if (sub.type === 'delete_student') {
                            serverStudents[name].deleted = true;
                            return;
                        } else {
                            serverStudents[name].deleted = false;
                        }

                        if (sub.petType && availablePets.some(p => p.name === sub.petType)) {
                            serverStudents[name].petType = sub.petType;
                        }

                        // 勋章兑换记录
                        if (sub.type === 'shop_consume_medal' && sub.medalCost) {
                            serverStudents[name].spentMedals += Number(sub.medalCost);
                            serverStudents[name].redemptionHistory.push({
                                type: 'shop',
                                item: sub.item,
                                cost: Number(sub.medalCost),
                                time: sub.submitted_at || new Date().toISOString()
                            });
                        } else if (sub.type === 'shop_consume') {
                            const score = Number(sub.score) || 0;
                            serverStudents[name].totalExp += score;
                        } else {
                            const score = Number(sub.score) || 0;
                            serverStudents[name].totalExp += score;
                            if (serverStudents[name].totalExp > serverStudents[name].maxExpEver) {
                                serverStudents[name].maxExpEver = serverStudents[name].totalExp;
                            }

                            if (score !== 0 && sub.type !== 'config_update') {
                                serverStudents[name].redemptionHistory.push({
                                    type: 'score',
                                    score: score,
                                    time: sub.submitted_at || new Date().toISOString()
                                });
                            }
                        }
                    });

                    // 2. 根据服务器聚合的数据重建本地 students 数组
                    const newStudents = [];
                    let idCounter = 1;
                    for (const name in serverStudents) {
                        const sData = serverStudents[name];

                        if (sData.deleted) continue;

                        const currentInfo = calculateLevelInfo(sData.totalExp);
                        const maxInfo = calculateLevelInfo(sData.maxExpEver);

                        let earnedMedals = maxInfo.level - 1;
                        if (earnedMedals < 0) earnedMedals = 0;
                        let currentMedals = earnedMedals - sData.spentMedals;

                        newStudents.push({
                                id: idCounter++,
                                name: name,
                                petType: sData.petType,
                                level: currentInfo.level,
                                currentExp: currentInfo.currentExp,
                                maxExp: currentInfo.maxExp,
                                totalExp: sData.totalExp < 0 ? 0 : sData.totalExp,
                                medals: currentMedals,
                                redemptionHistory: sData.redemptionHistory,
                                img: getPetImage(sData.petType, currentInfo.level)
                            });
                    }

                    students = newStudents;
                    saveStudents();
                    saveCache(students); // 成功获取后更新离线缓存
                    showOfflineBanner(false);
                } else {
                    students = [];
                    saveStudents();
                    saveCache([]);
                    showOfflineBanner(false);
                }
            } else {
                throw new Error('服务器返回异常状态');
            }
        } catch (error) {
            console.error('同步服务器数据失败:', error);
            // 尝试从离线缓存恢复
            const cached = loadCache();
            if (cached && cached.length > 0) {
                students = cached;
                saveStudents();
                showOfflineBanner(true);
            } else {
                // 无缓存时保留现有数据不丢失
                showOfflineBanner(false);
            }
        } finally {
            renderCards();
        }
    }

    // 加载宠物数据后再初始化，防止图片出不来
    loadPetsData().then(() => {
        initData();
    });
});