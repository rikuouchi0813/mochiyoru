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
        
        // デバッグ: 要素が正しく取得できているかチェック
        console.log('=== DOM Elements Check ===');
        console.log('memberInput:', this.memberInput);
        console.log('addMemberBtn:', this.addMemberBtn);
        console.log('memberList:', this.memberList);
        console.log('groupNameInput:', this.groupNameInput);
        console.log('createBtn:', this.createBtn);
        
        // 要素が見つからない場合のエラーハンドリング
        if (!this.memberInput) console.error('❌ memberName input not found');
        if (!this.addMemberBtn) console.error('❌ addMember button not found');
        if (!this.memberList) console.error('❌ memberList ul not found');
        if (!this.groupNameInput) console.error('❌ groupName input not found');
        if (!this.createBtn) console.error('❌ createGroupBtn not found');
        
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
        console.log('=== Setting up Event Listeners ===');
        
        if (this.addMemberBtn) {
            this.addMemberBtn.addEventListener('click', (e) => {
                console.log('🖱️ Add member button clicked');
                e.preventDefault();
                this.addMember();
            });
            console.log('✅ Add member button event listener set');
        } else {
            console.error('❌ Cannot set click listener - addMemberBtn is null');
        }
        
        if (this.memberInput) {
            this.memberInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    console.log('⌨️ Enter key pressed in member input');
                    e.preventDefault();
                    this.addMember();
                }
            });
            console.log('✅ Member input keydown listener set');
        } else {
            console.error('❌ Cannot set keydown listener - memberInput is null');
        }

        if (this.createBtn) {
            this.createBtn.addEventListener('click', (e) => {
                console.log('🖱️ Create/Update button clicked');
                e.preventDefault();
                if (this.isEditMode) {
                    this.updateGroup();
                } else {
                    this.createGroup();
                }
            });
            console.log('✅ Create/Update button event listener set');
        } else {
            console.error('❌ Cannot set click listener - createBtn is null');
        }
        
        console.log('=== Event Listeners Setup Complete ===');
    }

    addMember() {
        if (!this.memberInput) {
            console.error('メンバー入力フィールドが見つかりません');
            return;
        }

        const name = this.memberInput.value.trim();
        console.log('addMember() called with:', name);
        
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
        console.log('メンバー追加後の配列:', this.members);
        
        this.renderMembers();
        
        console.log('メンバー追加完了:', name, '現在のメンバー:', this.members);
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
        
        console.log('メンバーリストを更新:', this.members);
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
            console.log('=== グループ更新処理開始 ===');
            console.log('更新対象groupId:', this.editingGroupId);
            console.log('新しいグループ名:', groupName);
            console.log('新しいメンバー:', this.members);
            
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

            console.log('API Response status:', response.status);

            if (!response.ok) {
                // レスポンスの詳細を取得
                const errorText = await response.text();
                console.error('API Error Details:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                
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
            console.log('グループ更新成功:', data);

            // sessionStorageを更新（既存のgroupIdを保持）
            const updatedGroupData = {
                groupId: this.editingGroupId, // 既存のIDを保持
                groupName: groupName,
                members: this.members
            };
            
            console.log('SessionStorageを更新:', updatedGroupData);
            sessionStorage.setItem('groupData', JSON.stringify(updatedGroupData));

            // page4.htmlに戻る（既存のgroupIdを使用）
            const params = new URLSearchParams({
                groupId: this.editingGroupId, // 既存のIDを使用
                groupName: encodeURIComponent(groupName),
                members: JSON.stringify(this.members)
            });

            const redirectUrl = `/page4.html?${params.toString()}`;
            console.log('Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;

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
