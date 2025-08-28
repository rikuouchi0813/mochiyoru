class GroupManager {
    constructor() {
        this.members = [];
        this.isEditMode = false;
        this.editingGroupId = null;
        this.originalGroupData = null;
        
        this.bindElements();
        this.initialize();
        this.attachEventListeners();
    }

    bindElements() {
        this.memberInput = document.getElementById('memberName');
        this.addMemberBtn = document.getElementById('addMember');
        this.memberList = document.getElementById('memberList');
        this.groupNameInput = document.getElementById('groupName');
        this.createBtn = document.getElementById('createGroupBtn');
        this.pageTitle = document.getElementById('pageTitle');
        this.pageDescription = document.getElementById('pageDescription');
        this.buttonText = document.getElementById('buttonText');
        
        // 要素が見つからない場合のエラーハンドリング
        if (!this.pageTitle || !this.pageDescription || !this.buttonText) {
            console.warn('一部の要素が見つかりません。デフォルトの動作を使用します。');
        }
    }

    initialize() {
        console.log('GroupManager初期化開始');
        
        // 編集モードかどうかチェック
        const editMode = sessionStorage.getItem('editMode');
        const groupData = sessionStorage.getItem('groupData');
        
        console.log('editMode:', editMode);
        console.log('groupData:', groupData);
        
        if (editMode === 'members' && groupData) {
            this.setupEditMode(JSON.parse(groupData));
        } else {
            this.setupCreateMode();
        }
    }

    setupEditMode(groupData) {
        console.log('編集モード設定:', groupData);
        
        this.isEditMode = true;
        this.editingGroupId = groupData.groupId;
        this.originalGroupData = { ...groupData };
        
        // UI更新（要素が存在する場合のみ）
        if (this.pageTitle) {
            this.pageTitle.textContent = 'メンバーを編集しよう';
        }
        if (this.pageDescription) {
            this.pageDescription.textContent = 'メンバーを追加・削除して更新しましょう👇';
        }
        if (this.buttonText) {
            this.buttonText.textContent = 'メンバーを更新';
        }
        
        // フォームにデータ設定
        if (this.groupNameInput) {
            this.groupNameInput.value = groupData.groupName || '';
        }
        this.members = [...(groupData.members || [])];
        
        this.renderMembers();
        
        // editModeフラグをクリア
        sessionStorage.removeItem('editMode');
    }

    setupCreateMode() {
        console.log('新規作成モード設定');
        
        this.isEditMode = false;
        this.editingGroupId = null;
        this.originalGroupData = null;
        
        // UI更新（デフォルト状態）- 要素が存在する場合のみ
        if (this.pageTitle) {
            this.pageTitle.textContent = 'グループを作成しよう';
        }
        if (this.pageDescription) {
            this.pageDescription.textContent = 'グループ名を決めてメンバー全員の名前を追加しましょう👇';
        }
        if (this.buttonText) {
            this.buttonText.textContent = 'グループを作成';
        }
        
        this.members = [];
        this.renderMembers();
    }

    attachEventListeners() {
        if (this.addMemberBtn) {
            this.addMemberBtn.addEventListener('click', () => this.addMember());
        }
        
        if (this.memberInput) {
            this.memberInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addMember();
                }
            });
        }

        if (this.createBtn) {
            this.createBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isEditMode) {
                    this.updateGroup();
                } else {
                    this.createGroup();
                }
            });
        }
    }

    addMember() {
        if (!this.memberInput) {
            console.error('メンバー入力フィールドが見つかりません');
            return;
        }

        const name = this.memberInput.value.trim();
        if (!name) {
            alert('メンバー名を入力してください。');
            return;
        }

        if (this.members.includes(name)) {
            alert('すでに追加されているメンバーです。');
            this.memberInput.value = '';
            return;
        }

        this.members.push(name);
        this.memberInput.value = '';
        this.renderMembers();
        
        console.log('メンバー追加:', name, '現在のメンバー:', this.members);
    }

    removeMember(name) {
        this.members = this.members.filter(member => member !== name);
        this.renderMembers();
        
        console.log('メンバー削除:', name, '現在のメンバー:', this.members);
    }

    renderMembers() {
        if (!this.memberList) {
            console.error('メンバーリストが見つかりません');
            return;
        }

        this.memberList.innerHTML = '';
        
        this.members.forEach(member => {
            const li = document.createElement('li');
            li.className = 'member-tag';
            li.innerHTML = `
                ${member}
                <button type="button" class="remove-member">×</button>
            `;
            
            const removeBtn = li.querySelector('.remove-member');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.removeMember(member));
            }
            
            this.memberList.appendChild(li);
        });
    }

    async createGroup() {
        if (!this.groupNameInput) {
            console.error('グループ名入力フィールドが見つかりません');
            return;
        }

        const groupName = this.groupNameInput.value.trim();
        
        if (!groupName) {
            alert('グループ名を入力してください。');
            return;
        }
        
        if (this.members.length === 0) {
            alert('少なくとも1人のメンバーを追加してください。');
            return;
        }

        this.setLoading(true);

        try {
            console.log('グループ作成リクエスト:', { groupName, members: this.members });
            
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    groupName,
                    members: this.members
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('グループ作成成功:', data);

            // sessionStorageに保存
            const groupData = {
                groupId: data.groupId,
                groupName: groupName,
                members: this.members
            };
            
            sessionStorage.setItem('groupData', JSON.stringify(groupData));

            // page4.htmlに遷移
            const params = new URLSearchParams({
                groupId: data.groupId,
                groupName: encodeURIComponent(groupName),
                members: JSON.stringify(this.members)
            });

            window.location.href = `/page4.html?${params.toString()}`;

        } catch (error) {
            console.error('グループ作成エラー:', error);
            alert('グループの作成に失敗しました。ネットワーク接続を確認して、もう一度お試しください。');
        } finally {
            this.setLoading(false);
        }
    }

    async updateGroup() {
        if (!this.groupNameInput) {
            console.error('グループ名入力フィールドが見つかりません');
            return;
        }

        const groupName = this.groupNameInput.value.trim();
        
        if (!groupName) {
            alert('グループ名を入力してください。');
            return;
        }
        
        if (this.members.length === 0) {
            alert('少なくとも1人のメンバーを追加してください。');
            return;
        }

        if (!this.editingGroupId) {
            alert('グループIDが見つかりません。');
            return;
        }

        this.setLoading(true);

        try {
            console.log('グループ更新リクエスト:', {
                groupId: this.editingGroupId,
                groupName,
                members: this.members
            });
            
            const response = await fetch(`/api/groups/${this.editingGroupId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    groupName,
                    members: this.members
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('グループ更新成功:', data);

            // sessionStorageを更新
            const updatedGroupData = {
                groupId: this.editingGroupId,
                groupName: groupName,
                members: this.members
            };
            
            sessionStorage.setItem('groupData', JSON.stringify(updatedGroupData));

            // page4.htmlに戻る
            const params = new URLSearchParams({
                groupId: this.editingGroupId,
                groupName: encodeURIComponent(groupName),
                members: JSON.stringify(this.members)
            });

            window.location.href = `/page4.html?${params.toString()}`;

        } catch (error) {
            console.error('グループ更新エラー:', error);
            alert('メンバーの更新に失敗しました。ネットワーク接続を確認して、もう一度お試しください。');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        if (!this.createBtn || !this.buttonText) {
            console.warn('ボタン要素が見つかりません');
            return;
        }

        if (loading) {
            this.createBtn.classList.add('loading');
            this.buttonText.textContent = this.isEditMode ? '更新中...' : '作成中...';
            this.createBtn.style.pointerEvents = 'none';
        } else {
            this.createBtn.classList.remove('loading');
            this.buttonText.textContent = this.isEditMode ? 'メンバーを更新' : 'グループを作成';
            this.createBtn.style.pointerEvents = 'auto';
        }
    }
}

// DOMContentLoaded時にGroupManagerを初期化
document.addEventListener('DOMContentLoaded', () => {
    new GroupManager();
});
