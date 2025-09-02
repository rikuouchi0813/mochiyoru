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
    }

    initialize() {
        // 編集モードかどうかチェック
        const editMode = sessionStorage.getItem('editMode');
        const groupData = sessionStorage.getItem('groupData');
        
        if (editMode === 'members' && groupData) {
            this.setupEditMode(JSON.parse(groupData));
        } else {
            this.setupCreateMode();
        }
    }

    setupEditMode(groupData) {
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
            this.addMemberBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addMember();
            });
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
        if (!this.memberInput) return;

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
    }

    removeMember(name) {
        this.members = this.members.filter(member => member !== name);
        this.renderMembers();
    }

    renderMembers() {
        if (!this.memberList) return;

        this.memberList.innerHTML = '';
        
        this.members.forEach(member => {
            const li = document.createElement('li');
            li.className = 'member-tag';
            
            // メンバー名のテキスト部分を作成
            const memberText = document.createTextNode(member);
            li.appendChild(memberText);
            
            // 削除ボタンを作成
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-member';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => this.removeMember(member));
            
            li.appendChild(removeBtn);
            this.memberList.appendChild(li);
        });
    }

    async createGroup() {
        if (!this.groupNameInput) return;

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

            // sessionStorageに保存
            const groupData = {
                groupId: data.groupId,
                groupName: groupName,
                members: this.members
            };
            
            sessionStorage.setItem('groupData', JSON.stringify(groupData));

            // page3.htmlに遷移
            const params = new URLSearchParams({
                groupId: data.groupId,
                groupName: encodeURIComponent(groupName),
                members: JSON.stringify(this.members)
            });

            window.location.href = `/page3.html?${params.toString()}`;

        } catch (error) {
            console.error('グループ作成エラー:', error);
            alert('グループの作成に失敗しました。ネットワーク接続を確認して、もう一度お試しください。');
        } finally {
            this.setLoading(false);
        }
    }

    async updateGroup() {
        if (!this.groupNameInput) return;

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
            // Netlify Functionsのgroups-updateエンドポイントを呼び出し
            const response = await fetch(`/.netlify/functions/groups-update/${this.editingGroupId}`, {
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
                // レスポンスの詳細を取得
                const errorText = await response.text();
                
                // 404/405の場合は、エンドポイントが正しく設定されていない可能性
                if (response.status === 404) {
                    throw new Error('NETLIFY_FUNCTION_NOT_FOUND');
                } else if (response.status === 405) {
                    throw new Error('METHOD_NOT_ALLOWED');
                } else {
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
            }

            const data = await response.json();

            // sessionStorageを更新（既存のgroupIdを保持）
            const updatedGroupData = {
                groupId: this.editingGroupId,
                groupName: groupName,
                members: this.members
            };
            
            sessionStorage.setItem('groupData', JSON.stringify(updatedGroupData));

            // page4.htmlに戻る（既存のgroupIdを使用）
            const params = new URLSearchParams({
                groupId: this.editingGroupId,
                groupName: encodeURIComponent(groupName),
                members: JSON.stringify(this.members)
            });

            window.location.href = `/page4.html?${params.toString()}`;

        } catch (error) {
            console.error('グループ更新エラー:', error);
            
            let errorMessage = 'メンバーの更新に失敗しました。\n\n';
            
            if (error.message === 'NETLIFY_FUNCTION_NOT_FOUND') {
                errorMessage += 'Netlify Functionが見つかりません。\n';
                errorMessage += 'groups-update.js が正しくデプロイされているか確認してください。';
            } else if (error.message === 'METHOD_NOT_ALLOWED') {
                errorMessage += 'リクエストメソッドが許可されていません。';
            } else if (error.message.includes('500')) {
                errorMessage += 'サーバーでエラーが発生しました。少し時間をおいてからお試しください。';
            } else if (error.message.includes('404')) {
                errorMessage += 'グループが見つかりませんでした。URLが正しいか確認してください。';
            } else if (error.message.includes('Network')) {
                errorMessage += 'ネットワーク接続を確認してください。';
            } else {
                errorMessage += '詳細: ' + error.message;
            }
            
            alert(errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        if (!this.createBtn || !this.buttonText) return;

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
