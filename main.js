import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5DBFCeHAy0ZhM3ITwu4MklaGqtqv9vhU",
  authDomain: "dice-7fe9a.firebaseapp.com",
  databaseURL: "https://dice-7fe9a-default-rtdb.firebaseio.com",
  projectId: "dice-7fe9a"
}
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let roomId="", mySide="", myName="";
const BODY_PARTS=["머리","어깨","팔","손목","복부","옆구리","허벅지","종아리"];
const hpColor=hp=>hp>30?"#2ecc71":hp>15?"#f1c40f":"#e74c3c";

const roomInput=document.getElementById("roomInput");
const createRoomBtn=document.getElementById("createRoom");
const enterRoomBtn=document.getElementById("enterRoom");
const roomLink=document.getElementById("roomLink");
const roomUI=document.getElementById("roomUI");
const meEl=document.getElementById("me");
const turnEl=document.getElementById("turn");
const nameA=document.getElementById("nameA");
const nameB=document.getElementById("nameB");
const hpA=document.getElementById("hpA");
const hpB=document.getElementById("hpB");
const statusA=document.getElementById("statusA");
const statusB=document.getElementById("statusB");
const btnAttack=document.getElementById("attack");
const btnRestart=document.getElementById("restart");
const btnSummary=document.getElementById("copySummary");
const logsEl=document.getElementById("logs");

function updateUI(s){
    turnEl.innerText = s.turn||"A";
    nameA.innerText = s.players.A?.name||"대기중";
    nameB.innerText = s.players.B?.name||"대기중";
    statusA.innerText = s.players.A?.bleeding?"🩸 출혈":"";
    statusB.innerText = s.players.B?.bleeding?"🩸 출혈":"";
    hpA.style.width=((s.players.A?.hp||50)/50*100)+"%"; hpA.style.background=hpColor(s.players.A?.hp||50);
    hpB.style.width=((s.players.B?.hp||50)/50*100)+"%"; hpB.style.background=hpColor(s.players.B?.hp||50);
    btnAttack.disabled = s.status!=="playing"||s.turn!==mySide;
    btnRestart.style.display = s.status==="finished"?"block":"none";
    btnSummary.style.display = (s.status==="finished"&&s.winner===mySide)?"block":"none";
    logsEl.innerHTML=""; (s.logs||[]).forEach(l=>{const li=document.createElement("li"); li.innerText=l; logsEl.appendChild(li);});
}

function showNoirCard({winnerName,loserName,injuryPart}){
    document.getElementById("noirSummary").innerText=`${winnerName}, ${loserName} 제압 성공.`;
    document.getElementById("noirInjury").innerText=`${loserName}, ${injuryPart}에 부상을 입고 전투 종료.`;
    document.getElementById("noirWinner").innerText=`WINNER: ${winnerName}`;
    document.getElementById("noirDate").innerText=new Date().toLocaleDateString();
}

async function joinRoom(roomId,myName){
    const roomRef=ref(db,`rooms/${roomId}`);
    let snap=await get(roomRef);
    if(!snap.exists()) return alert("방이 존재하지 않습니다");
    let data=snap.val();
    if(!data.players){
        await set(roomRef,{
            players:{A:{name:"대기중",hp:50,bleeding:false},B:{name:"대기중",hp:50,bleeding:false}},
            turn:"A",status:"waiting",winner:null,logs:["방 초기화"]
        }); snap=await get(roomRef); data=snap.val();
    }
    if(!data.players) return alert("방 구조가 잘못되었습니다.");
    if(!data.players.A?.name || data.players.A.name==="대기중"){ mySide="A"; await update(roomRef,{"players/A/name":myName}); }
    else if(!data.players.B?.name || data.players.B.name==="대기중"){ mySide="B"; await update(roomRef,{"players/B/name":myName}); }
    else return alert("이미 2명이 접속중입니다!");
    if(data.status==="waiting") await update(roomRef,{status:"playing",logs:[...(data.logs||[]),"2번째 플레이어 입장, 전투 시작"]});
    snap=await get(roomRef); data=snap.val();
    roomUI.style.display="block"; meEl.innerText=mySide; localStorage.setItem("diceSide",mySide); localStorage.setItem("diceName",myName);
    updateUI(data);
    onValue(roomRef,snap=>{ const s=snap.val(); if(!s)return; updateUI(s); });
    const playerRef = ref(db, `rooms/${roomId}/players/${mySide}`);
    onDisconnect(playerRef).remove();
}

createRoomBtn.onclick=async()=>{
    roomId=roomInput.value.trim(); if(!roomId)return alert("방 번호 입력!"); myName=prompt("플레이어 이름 입력")||"Player";
    const roomRef=ref(db,`rooms/${roomId}`); const snap=await get(roomRef);
    if(!snap.exists()){
        mySide=Math.random()<0.5?"A":"B";
        await set(roomRef,{players:{A: mySide==="A"?{name:myName,hp:50,bleeding:false}:{name:"대기중",hp:50,bleeding:false},B: mySide==="B"?{name:myName,hp:50,bleeding:false}:{name:"대기중",hp:50,bleeding:false}}, turn:"A", status:"waiting", winner:null, logs:["새 방 생성"]});
        alert("방 생성됨! URL 공유: ?room="+roomId); roomLink.innerText="URL: "+location.href+"?room="+roomId;
    } else { alert("이미 존재하는 방입니다!"); }
    roomUI.style.display="block"; meEl.innerText=mySide; localStorage.setItem("diceSide",mySide); localStorage.setItem("diceName",myName);
    joinRoom(roomId,myName);
};

enterRoomBtn.onclick=async()=>{
    const inputRoom=roomInput.value.trim(); if(!inputRoom) return alert("방 번호 입력!");
    myName=prompt("플레이어 이름 입력")||"Player";
    joinRoom(inputRoom,myName);
};

// 공격
btnAttack.onclick=async()=>{
    const roomRef=ref(db,`rooms/${roomId}`); const snap=await get(roomRef); const s=snap.val();
    if(!s || s.status!=="playing")return;
    const attacker=mySide,target=mySide==="A"?"B":"A",targetName=s.players[target]?.name||"";
    let updates={},logs=[...(s.logs||[])];
    if(s.players[attacker]?.bleeding){updates[`players/${attacker}/hp`]=s.players[attacker].hp-2; logs.push(`🩸 ${myName}, 출혈로 체력 감소 (-2)`);}
    const dice=Math.floor(Math.random()*20)+1; let newHp=(s.players[target]?.hp||0)-dice; logs.push(`⚔️ ${myName}의 공격 (${dice})`);
    let bleeding=s.players[target]?.bleeding||false;
    if(dice>=15 && Math.random()<0.3){bleeding=true; logs.push(`🩸 ${targetName}, 출혈 상태에 빠졌다`);}
    updates[`players/${target}/hp`]=newHp; updates[`players/${target}/bleeding`]=bleeding; updates.turn=target; updates.logs=logs;
    if(newHp<=0){ const part=BODY_PARTS[Math.floor(Math.random()*BODY_PARTS.length)]; updates.status="finished"; updates.winner=mySide;
        updates.logs=[...logs,`🏆 ${myName} 승리`,`💥 ${targetName}, ${part} 부위에 부상을 입었다.`];
        showNoirCard({winnerName:myName,loserName:targetName,injuryPart:part});
    }
    await update(roomRef,updates);
};

// 재시작
btnRestart.onclick=async()=>{
    const roomRef=ref(db,`rooms/${roomId}`);
    await update(roomRef,{
        players:{A:{name:nameA.innerText,hp:50,bleeding:false},B:{nameB.innerText,hp:50,bleeding:false}},
        turn:"A", status:"playing", winner:null, logs:["전투 재시작"]
    });
};

// 요약
btnSummary.onclick=async()=>{
    const roomRef=ref(db,`rooms/${roomId}`); const snap=await get(roomRef); const s=snap.val();
    if(!s || s.winner!==mySide)return;
    const loserSide=mySide==="A"?"B":"A"; const loserName=s.players[loserSide]?.name||"";
    const attacks=s.logs.filter(l=>l.includes("⚔️")).length;
    const injury=s.logs.find(l=>l.includes("💥"))||"";
    const summary=`[전투 결과 보고]\n${myName}, ${attacks}회의 교전을 통해 ${loserName} 제압 성공.\n${injury}`.trim();
    await navigator.clipboard.writeText(summary); alert("복사되었습니다");
};
